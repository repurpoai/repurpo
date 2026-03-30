import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { getClientIp, verifyTurnstileToken } from "@/lib/security";

const signupSchema = z.object({
  fullName: z.string().trim().max(80, "Full name is too long.").optional(),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  captchaToken: z.string().trim().min(1, "Complete the security check and try again.")
});

export async function POST(request: Request) {
  try {
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
      return NextResponse.json(
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
      return NextResponse.json(
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
        data: {
          full_name: fullName ?? null
        }
      }
    });

    if (error) {
      return NextResponse.json(
        {
          error: error.message
        },
        { status: 400 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        {
          error: "Account could not be created."
        },
        { status: 400 }
      );
    }

    if (!data.session) {
      const signInResult = await supabase.auth.signInWithPassword({ email, password });

      if (signInResult.error) {
        return NextResponse.json({ ok: true, redirectTo: "/login", notice: "Account created. Log in to continue." });
      }
    }

    const response = NextResponse.json({ ok: true, redirectTo: "/dashboard" });
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Signup failed."
      },
      { status: 500 }
    );
  }
}
