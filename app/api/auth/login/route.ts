import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { assertTrustedOrigin, jsonNoStore, normalizeCookieOptions } from "@/lib/http-security";
import {
  assertLoginAllowed,
  clearLoginFailures,
  getClientIp,
  recordLoginFailure,
  verifyTurnstileToken
} from "@/lib/security";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  password: z.string().min(6, "Password must be at least 6 characters."),
  captchaToken: z.string().trim().min(1, "Complete the security check and try again.")
});

function getFriendlyLoginError(message?: string | null) {
  const normalized = message?.toLowerCase() ?? "";

  if (normalized.includes("email not confirmed") || normalized.includes("email_not_confirmed")) {
    return {
      status: 403,
      message: "Please confirm your email first, then log in."
    } as const;
  }

  if (normalized.includes("invalid login credentials")) {
    return {
      status: 401,
      message: "Invalid login details."
    } as const;
  }

  return {
    status: 401,
    message: message || "Login failed."
  } as const;
}

export async function POST(request: Request) {
  try {
    const trustedOrigin = assertTrustedOrigin(request);
    if (!trustedOrigin.ok) {
      return trustedOrigin.response;
    }

    const formData = await request.formData();
    const parsed = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      captchaToken: formData.get("captchaToken")
    });

    if (!parsed.success) {
      return jsonNoStore(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid login details."
        },
        { status: 400 }
      );
    }

    const { email, password, captchaToken } = parsed.data;
    const ip = await getClientIp();
    const gate = await assertLoginAllowed(email, ip);

    if (!gate.allowed) {
      return jsonNoStore(
        {
          error: "Too many login attempts. Try again later."
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(gate.retryAfterSeconds)
          }
        }
      );
    }

    const turnstile = await verifyTurnstileToken(captchaToken, ip);

    if (!turnstile.success) {
      return jsonNoStore(
        {
          error: turnstile.error
        },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const cookiesToSet: Array<{
      name: string;
      value: string;
      options?: Parameters<typeof cookieStore.set>[2];
    }> = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(newCookies) {
            newCookies.forEach(({ name, value, options }) => {
              cookiesToSet.push({ name, value, options });
            });
          }
        }
      }
    );

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      const friendly = getFriendlyLoginError(error.message);

      if (friendly.status === 403) {
        return jsonNoStore({ error: friendly.message }, { status: friendly.status });
      }

      const failure = await recordLoginFailure(email, ip);
      const status = failure.blocked ? 429 : friendly.status;

      return jsonNoStore(
        {
          error: failure.blocked ? "Too many login attempts. Try again later." : friendly.message
        },
        status === 429
          ? {
              status,
              headers: {
                "Retry-After": String(failure.retryAfterSeconds ?? 60)
              }
            }
          : { status }
      );
    }

    await clearLoginFailures(email, ip);

    const response = jsonNoStore({ ok: true, redirectTo: "/dashboard" });
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, normalizeCookieOptions(options));
    });

    return response;
  } catch (error) {
    return jsonNoStore(
      {
        error: error instanceof Error ? error.message : "Login failed."
      },
      { status: 500 }
    );
  }
}
