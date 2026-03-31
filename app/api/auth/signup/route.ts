import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { assertTrustedOrigin, jsonNoStore, normalizeCookieOptions } from "@/lib/http-security";
import { getClientIp, verifyTurnstileToken } from "@/lib/security";

const signupSchema = z.object({
  fullName: z.string().trim().max(80, "Full name is too long.").optional(),
  email: z.string().trim().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  password: z.string().min(6, "Password must be at least 6 characters."),
  captchaToken: z.string().trim().min(1, "Complete the security check and try again.")
});

function isEmailConfirmationRequired(message?: string | null) {
  const normalized = message?.toLowerCase() ?? "";
  return normalized.includes("email not confirmed") || normalized.includes("email_not_confirmed");
}

function isInvalidCredentials(message?: string | null) {
  const normalized = message?.toLowerCase() ?? "";
  return normalized.includes("invalid login credentials") || normalized.includes("invalid login details");
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  try {
    const trustedOrigin = assertTrustedOrigin(request);
    if (!trustedOrigin.ok) {
      return trustedOrigin.response;
    }

    const formData = await request.formData();
    const parsed = signupSchema.safeParse({
      fullName:
        typeof formData.get("fullName") === "string" && formData.get("fullName")?.toString().trim()
          ? formData.get("fullName")
          : undefined,
      email: formData.get("email"),
      password: formData.get("password"),
      captchaToken: formData.get("captchaToken")
    });

    if (!parsed.success) {
      return jsonNoStore(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid signup details."
        },
        { status: 400 }
      );
    }

    const { fullName, email, password, captchaToken } = parsed.data;
    const ip = await getClientIp();
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

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: new URL("/auth/confirm?next=/dashboard", request.url).toString(),
        data: {
          full_name: fullName ?? null
        }
      }
    });

    if (error) {
      return jsonNoStore(
        {
          error: error.message
        },
        { status: 400 }
      );
    }

    if (!data.user) {
      return jsonNoStore(
        {
          error: "Account could not be created."
        },
        { status: 400 }
      );
    }

    let sessionReady = Boolean(data.session);

    if (!sessionReady) {
      let signInResult = await supabase.auth.signInWithPassword({ email, password });

      if (signInResult.error && isInvalidCredentials(signInResult.error.message)) {
        await wait(500);
        signInResult = await supabase.auth.signInWithPassword({ email, password });
      }

      if (signInResult.error) {
        if (isEmailConfirmationRequired(signInResult.error.message)) {
          return jsonNoStore({
            ok: true,
            redirectTo: "/check-email"
          });
        }

        return jsonNoStore(
          {
            error: signInResult.error.message || "Account created, but automatic login failed."
          },
          { status: 400 }
        );
      }

      sessionReady = true;
    }

    const response = jsonNoStore({ ok: true, redirectTo: sessionReady ? "/dashboard" : "/check-email" });
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, normalizeCookieOptions(options));
    });

    return response;
  } catch (error) {
    return jsonNoStore(
      {
        error: error instanceof Error ? error.message : "Signup failed."
      },
      { status: 500 }
    );
  }
}
