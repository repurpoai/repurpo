import crypto from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

type RateLimitScope = "login_ip" | "login_email";

type AuthRateLimitRecord = {
  key: string;
  scope: RateLimitScope;
  attempt_count: number;
  window_started_at: string;
  blocked_until: string | null;
};

type TurnstileVerificationResult = {
  success: boolean;
  "error-codes"?: string[];
};

const LOGIN_IP_MAX_ATTEMPTS = 5;
const LOGIN_EMAIL_MAX_ATTEMPTS = 5;
const LOGIN_IP_WINDOW_MINUTES = 10;
const LOGIN_EMAIL_WINDOW_MINUTES = 30;
const LOGIN_LOCK_MINUTES = 30;

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function makeKey(scope: RateLimitScope, rawValue: string) {
  return `${scope}:${sha256(rawValue.trim().toLowerCase())}`;
}

export async function getClientIp() {
  const headerStore = await headers();

  const forwardedFor = headerStore.get("x-forwarded-for");
  const firstForwardedIp = forwardedFor?.split(",")[0]?.trim();

  return (
    headerStore.get("cf-connecting-ip") ??
    firstForwardedIp ??
    headerStore.get("x-real-ip") ??
    "0.0.0.0"
  );
}

export async function verifyTurnstileToken(token: string | null | undefined, remoteIp?: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      return { success: true } as const;
    }

    return {
      success: false,
      error: "Turnstile is not configured on the server."
    } as const;
  }

  if (!token) {
    return {
      success: false,
      error: "Complete the security check and try again."
    } as const;
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      secret,
      response: token,
      ...(remoteIp ? { remoteip: remoteIp } : {})
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    return {
      success: false,
      error: "Security verification is temporarily unavailable. Try again in a moment."
    } as const;
  }

  const data = (await response.json()) as TurnstileVerificationResult;

  if (!data.success) {
    const errorCodes = data["error-codes"] ?? [];
    const isExpired = errorCodes.includes("timeout-or-duplicate");

    return {
      success: false,
      error: isExpired
        ? "Security check expired. Please complete it again."
        : "Security verification failed. Please try again."
    } as const;
  }

  return { success: true } as const;
}

async function getExistingRateLimits(keys: string[]) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("auth_rate_limits")
    .select("key, scope, attempt_count, window_started_at, blocked_until")
    .in("key", keys);

  if (error) {
    throw new Error("Could not read login rate-limit state.");
  }

  return new Map((data ?? []).map((row) => [row.key, row as AuthRateLimitRecord]));
}

function isStillBlocked(blockedUntil: string | null, now: Date) {
  return Boolean(blockedUntil && new Date(blockedUntil).getTime() > now.getTime());
}

function getRetryAfterSeconds(blockedUntil: string | null, now: Date) {
  if (!blockedUntil) return LOGIN_LOCK_MINUTES * 60;

  const diffMs = new Date(blockedUntil).getTime() - now.getTime();
  return Math.max(1, Math.ceil(diffMs / 1000));
}

export async function assertLoginAllowed(email: string, ip: string) {
  const now = new Date();
  const keys = [makeKey("login_ip", ip), makeKey("login_email", email)];
  const existing = await getExistingRateLimits(keys);

  for (const key of keys) {
    const row = existing.get(key);

    if (row && isStillBlocked(row.blocked_until, now)) {
      return {
        allowed: false,
        retryAfterSeconds: getRetryAfterSeconds(row.blocked_until, now)
      } as const;
    }
  }

  return { allowed: true } as const;
}

function buildFailureRow(
  scope: RateLimitScope,
  rawValue: string,
  now: Date,
  existing: AuthRateLimitRecord | undefined
) {
  const key = makeKey(scope, rawValue);
  const windowMinutes = scope === "login_ip" ? LOGIN_IP_WINDOW_MINUTES : LOGIN_EMAIL_WINDOW_MINUTES;
  const threshold = scope === "login_ip" ? LOGIN_IP_MAX_ATTEMPTS : LOGIN_EMAIL_MAX_ATTEMPTS;

  const windowStartedAt = existing ? new Date(existing.window_started_at) : null;
  const windowExpired = !windowStartedAt || now.getTime() - windowStartedAt.getTime() > windowMinutes * 60 * 1000;
  const attemptCount = windowExpired ? 1 : (existing?.attempt_count ?? 0) + 1;
  const blockedUntil =
    attemptCount >= threshold
      ? new Date(now.getTime() + LOGIN_LOCK_MINUTES * 60 * 1000).toISOString()
      : null;

  return {
    key,
    scope,
    attempt_count: attemptCount,
    window_started_at: windowExpired ? now.toISOString() : existing?.window_started_at ?? now.toISOString(),
    blocked_until: blockedUntil,
    last_attempt_at: now.toISOString()
  };
}

export async function recordLoginFailure(email: string, ip: string) {
  const now = new Date();
  const keys = [makeKey("login_ip", ip), makeKey("login_email", email)];
  const existing = await getExistingRateLimits(keys);
  const admin = createAdminClient();

  const rows = [
    buildFailureRow("login_ip", ip, now, existing.get(makeKey("login_ip", ip))),
    buildFailureRow("login_email", email, now, existing.get(makeKey("login_email", email)))
  ];

  const { error } = await admin.from("auth_rate_limits").upsert(rows, { onConflict: "key" });

  if (error) {
    throw new Error("Could not record failed login attempt.");
  }

  const longestRetryAfter = rows
    .map((row) => getRetryAfterSeconds(row.blocked_until, now))
    .reduce((max, value) => Math.max(max, value), 0);

  const blocked = rows.some((row) => row.blocked_until);

  return {
    blocked,
    retryAfterSeconds: blocked ? longestRetryAfter : undefined
  } as const;
}

export async function clearLoginFailures(email: string, ip: string) {
  const admin = createAdminClient();
  const keys = [makeKey("login_ip", ip), makeKey("login_email", email)];

  const { error } = await admin.from("auth_rate_limits").delete().in("key", keys);

  if (error) {
    throw new Error("Could not clear login rate-limit state.");
  }
}
