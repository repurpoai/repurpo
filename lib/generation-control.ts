import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRedisClient } from "@/lib/upstash";

const GENERATION_USER_WINDOW_MINUTES = 10;
const GENERATION_USER_MAX_ATTEMPTS = 12;
const GENERATION_IP_WINDOW_MINUTES = 10;
const GENERATION_IP_MAX_ATTEMPTS = 30;
const GENERATION_LOCK_MINUTES = 30;
const GENERATION_SLOT_LOCK_SECONDS = 180;
const GENERATION_SLOT_COUNT = 4;

type GenerationScope = "generation_user" | "generation_ip";

type GenerationRateLimitRow = {
  key: string;
  scope: GenerationScope;
  attempt_count: number;
  window_started_at: string;
  blocked_until: string | null;
};

type ClaimedGenerationSlot = {
  slot_id: number;
  slot_key: string;
  locked_until: string;
};

type RedisSlotValue = {
  ownerKey: string;
  ownerUserId: string;
  lockedAt: string;
};

export type GenerationSlotLease =
  | {
      slotId: number;
      ownerKey: string;
      lockedUntil: string;
    }
  | {
      skipped: true;
    };

function sha256(value: string) {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function makeKey(scope: GenerationScope, rawValue: string) {
  return `${scope}:${sha256(rawValue)}`;
}

function isMissingTableError(error: unknown) {
  const record = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  } | null;

  const haystack = `${record?.code ?? ""} ${record?.message ?? ""} ${record?.details ?? ""} ${record?.hint ?? ""}`.toLowerCase();

  return (
    // Missing table (PostgreSQL)
    record?.code === "42P01" ||
    // Missing function (PostgreSQL UNDEFINED_FUNCTION) — returned when the DB RPC
    // function does not exist (e.g. claim_generation_slot not yet migrated)
    record?.code === "42883" ||
    // PostgREST schema-cache miss or function-not-found codes
    record?.code === "PGRST116" ||
    record?.code === "PGRST202" ||
    // Message-based fallbacks
    haystack.includes('relation "public.generation_rate_limits" does not exist') ||
    haystack.includes('relation "public.generation_slots" does not exist') ||
    haystack.includes('relation "generation_rate_limits" does not exist') ||
    haystack.includes('relation "generation_slots" does not exist') ||
    haystack.includes("could not find the table") ||
    haystack.includes("could not find the function") ||
    haystack.includes("no function matches") ||
    haystack.includes("does not exist") ||
    haystack.includes("schema cache") ||
    haystack.includes("rpc")
  );
}

function getWindowMinutes(scope: GenerationScope) {
  return scope === "generation_user" ? GENERATION_USER_WINDOW_MINUTES : GENERATION_IP_WINDOW_MINUTES;
}

function getMaxAttempts(scope: GenerationScope) {
  return scope === "generation_user" ? GENERATION_USER_MAX_ATTEMPTS : GENERATION_IP_MAX_ATTEMPTS;
}

function getAttemptRedisKey(scope: GenerationScope, rawValue: string) {
  return `repurpo:generation:attempt:${makeKey(scope, rawValue)}`;
}

function getBlockRedisKey(scope: GenerationScope, rawValue: string) {
  return `${getAttemptRedisKey(scope, rawValue)}:blocked`;
}

function getSlotRedisKey(slotId: number) {
  return `repurpo:generation:slot:${slotId}`;
}

function parseRedisSlotValue(raw: unknown): RedisSlotValue | null {
  if (!raw) {
    return null;
  }

  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<RedisSlotValue>;
  if (
    typeof record.ownerKey !== "string" ||
    typeof record.ownerUserId !== "string" ||
    typeof record.lockedAt !== "string"
  ) {
    return null;
  }

  return {
    ownerKey: record.ownerKey,
    ownerUserId: record.ownerUserId,
    lockedAt: record.lockedAt
  };
}

async function recordAttemptWithRedis(scope: GenerationScope, rawValue: string, now: Date): Promise<{
  allowed: true;
} | {
  allowed: false;
  retryAfterSeconds: number;
} | undefined> {
  const redis = getRedisClient();
  if (!redis) {
    return undefined;
  }

  const attemptKey = getAttemptRedisKey(scope, rawValue);
  const blockKey = getBlockRedisKey(scope, rawValue);
  const windowSeconds = getWindowMinutes(scope) * 60;
  const maxAttempts = getMaxAttempts(scope);

  try {
    const blockedTtl = await redis.ttl(blockKey);
    if (typeof blockedTtl === "number" && blockedTtl > 0) {
      return {
        allowed: false as const,
        retryAfterSeconds: blockedTtl
      };
    }

    const attemptCount = await redis.incr(attemptKey);
    if (attemptCount === 1) {
      await redis.expire(attemptKey, windowSeconds);
    }

    if (attemptCount > maxAttempts) {
      const blockSeconds = GENERATION_LOCK_MINUTES * 60;
      await redis.set(blockKey, JSON.stringify({ blockedAt: now.toISOString() }), {
        ex: blockSeconds
      });

      return {
        allowed: false as const,
        retryAfterSeconds: blockSeconds
      };
    }

    return { allowed: true as const };
  } catch {
    return undefined;
  }
}

async function readExistingLimits(keys: string[]) {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("generation_rate_limits")
      .select("key, scope, attempt_count, window_started_at, blocked_until")
      .in("key", keys);

    if (error || !data) {
      return new Map<string, GenerationRateLimitRow>();
    }

    return new Map(
      (data as GenerationRateLimitRow[]).map((row) => [row.key, row])
    );
  } catch (error) {
    if (isMissingTableError(error)) {
      return new Map<string, GenerationRateLimitRow>();
    }

    throw error;
  }
}

function getRetryAfterSeconds(blockedUntil: string | null, now: Date) {
  if (!blockedUntil) return GENERATION_LOCK_MINUTES * 60;

  const diffMs = new Date(blockedUntil).getTime() - now.getTime();
  return Math.max(1, Math.ceil(diffMs / 1000));
}

function buildAttemptRow(
  scope: GenerationScope,
  rawValue: string,
  now: Date,
  existing: GenerationRateLimitRow | undefined
) {
  const key = makeKey(scope, rawValue);
  const windowMinutes = getWindowMinutes(scope);
  const maxAttempts = getMaxAttempts(scope);
  const windowStartedAt = existing ? new Date(existing.window_started_at) : null;
  const windowExpired = !windowStartedAt || now.getTime() - windowStartedAt.getTime() > windowMinutes * 60 * 1000;
  const attemptCount = windowExpired ? 1 : (existing?.attempt_count ?? 0) + 1;
  const blockedUntil =
    attemptCount >= maxAttempts
      ? new Date(now.getTime() + GENERATION_LOCK_MINUTES * 60 * 1000).toISOString()
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

export async function recordGenerationAttempt(userId: string, ip: string | null) {
  const now = new Date();

  const userResult = await recordAttemptWithRedis("generation_user", userId, now);
  const ipResult = ip ? await recordAttemptWithRedis("generation_ip", ip, now) : undefined;

  if (userResult !== undefined && (ip ? ipResult !== undefined : true)) {
    const redisBlocked = [userResult, ipResult].find(
      (result): result is { allowed: false; retryAfterSeconds: number } =>
        Boolean(result && "allowed" in result && result.allowed === false)
    );

    if (redisBlocked) {
      return {
        allowed: false as const,
        retryAfterSeconds: redisBlocked.retryAfterSeconds
      };
    }

    return { allowed: true as const };
  }

  const keys = [makeKey("generation_user", userId), ...(ip ? [makeKey("generation_ip", ip)] : [])];
  const existing = await readExistingLimits(keys);
  const admin = createAdminClient();

  const rows = [
    buildAttemptRow("generation_user", userId, now, existing.get(makeKey("generation_user", userId))),
    ...(ip ? [buildAttemptRow("generation_ip", ip, now, existing.get(makeKey("generation_ip", ip)))] : [])
  ];

  try {
    const { error } = await admin.from("generation_rate_limits").upsert(rows, { onConflict: "key" });
    if (error) {
      if (isMissingTableError(error)) {
        return { allowed: true as const };
      }

      throw error;
    }
  } catch (error) {
    if (isMissingTableError(error)) {
      return { allowed: true as const };
    }

    throw error;
  }

  const blockedRow = rows.find((row) => row.blocked_until);
  if (blockedRow) {
    return {
      allowed: false as const,
      retryAfterSeconds: getRetryAfterSeconds(blockedRow.blocked_until, now)
    };
  }

  return { allowed: true as const };
}

async function acquireGenerationSlotWithRedis(ownerKey: string, ownerUserId: string): Promise<GenerationSlotLease | null | undefined> {
  const redis = getRedisClient();
  if (!redis) {
    return undefined;
  }

  const payload: RedisSlotValue = {
    ownerKey,
    ownerUserId,
    lockedAt: new Date().toISOString()
  };

  try {
    for (let slotId = 1; slotId <= GENERATION_SLOT_COUNT; slotId += 1) {
      const slotKey = getSlotRedisKey(slotId);
      const acquired = await redis.set(slotKey, JSON.stringify(payload), {
        nx: true,
        ex: GENERATION_SLOT_LOCK_SECONDS
      });

      if (acquired) {
        return {
          slotId,
          ownerKey,
          lockedUntil: new Date(Date.now() + GENERATION_SLOT_LOCK_SECONDS * 1000).toISOString()
        };
      }
    }
  } catch {
    return undefined;
  }

  return null;
}

export async function acquireGenerationSlot(ownerKey: string, ownerUserId: string): Promise<GenerationSlotLease | null> {
  const redisLease = await acquireGenerationSlotWithRedis(ownerKey, ownerUserId);
  if (redisLease !== undefined) {
    return redisLease;
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("claim_generation_slot", {
      p_owner_key: ownerKey,
      p_owner_user_id: ownerUserId,
      p_lock_seconds: GENERATION_SLOT_LOCK_SECONDS
    });

    if (error) {
      if (isMissingTableError(error)) {
        return { skipped: true };
      }

      throw error;
    }

    const rows = Array.isArray(data) ? (data as ClaimedGenerationSlot[]) : [];
    const slot = rows[0];

    if (!slot) {
      return null;
    }

    return {
      slotId: slot.slot_id,
      ownerKey,
      lockedUntil: slot.locked_until
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { skipped: true };
    }

    throw error;
  }
}

async function releaseGenerationSlotWithRedis(slotId: number, ownerKey: string) {
  const redis = getRedisClient();
  if (!redis) {
    return false;
  }

  try {
    const slotKey = getSlotRedisKey(slotId);
    const raw = await redis.get(slotKey);
    const parsed = parseRedisSlotValue(raw);

    if (!parsed || parsed.ownerKey !== ownerKey) {
      return true;
    }

    await redis.del(slotKey);
    return true;
  } catch {
    return false;
  }
}

export async function releaseGenerationSlot(slotId: number, ownerKey: string) {
  const released = await releaseGenerationSlotWithRedis(slotId, ownerKey);
  if (released) {
    return;
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("release_generation_slot", {
      p_slot_id: slotId,
      p_owner_key: ownerKey
    });

    if (error && !isMissingTableError(error)) {
      console.warn("Could not release generation slot:", error);
    }
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.warn("Could not release generation slot:", error);
    }
  }
}

export async function claimGenerationAdmission(userId: string, ip: string | null) {
  return recordGenerationAttempt(userId, ip);
}
