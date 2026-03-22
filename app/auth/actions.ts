"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthActionState = {
  error: string | null;
};

export const initialAuthActionState: AuthActionState = {
  error: null
};

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters.")
});

const signupSchema = z.object({
  fullName: z.string().trim().max(80, "Full name is too long.").optional(),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters.")
});

export async function loginAction(
  _: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid login details."
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return {
      error: error.message
    };
  }

  redirect("/dashboard");
}

export async function signupAction(
  _: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    fullName:
      typeof formData.get("fullName") === "string" && formData.get("fullName")?.toString().trim()
        ? formData.get("fullName")
        : undefined,
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid signup details."
    };
  }

  const { fullName, email, password } = parsed.data;

  const supabase = await createClient();
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
    return {
      error: error.message
    };
  }

  if (!data.session) {
    const signInResult = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInResult.error) {
      return {
        error:
          "Account created, but there is no active session yet. Disable Confirm Email in Supabase Auth > Providers > Email for instant dashboard access, or verify the email and then log in."
      };
    }
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}