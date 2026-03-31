import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

function normalizeMessage(value: string | null) {
  if (!value) {
    return null;
  }

  return value.replace(/\+/g, " ");
}

function buildRedirect(request: NextRequest, pathname: string, params?: Record<string, string | null | undefined>) {
  const url = new URL(pathname, request.url);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nextPath = getSafeNextPath(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const queryError = normalizeMessage(searchParams.get("error_description") ?? searchParams.get("error"));

  if (queryError) {
    return buildRedirect(request, "/login", {
      error: queryError
    });
  }

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type
    });

    if (!error) {
      return buildRedirect(request, nextPath);
    }

    return buildRedirect(request, "/login", {
      error: error.message || "This confirmation link is invalid or expired. Please request a fresh one."
    });
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return buildRedirect(request, nextPath);
    }

    const normalized = error.message?.toLowerCase() ?? "";
    const message = normalized.includes("code verifier")
      ? "Email confirmation is using the wrong auth flow. Update your Supabase Confirm signup email template to use token_hash, then try the newest confirmation email again."
      : error.message || "This confirmation link is invalid or expired. Please request a fresh one.";

    return buildRedirect(request, "/login", {
      error: message
    });
  }

  return buildRedirect(request, "/login", {
    error: "This confirmation link is invalid or incomplete."
  });
}
