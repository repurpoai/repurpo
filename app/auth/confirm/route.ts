import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { applyPrivateNoStore } from "@/lib/http-security";
import { createClient } from "@/lib/supabase/server";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

function redirectWithMessage(request: NextRequest, pathname: string, key: "error" | "notice", message: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  url.searchParams.set(key, message);
  return applyPrivateNoStore(NextResponse.redirect(url));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const nextPath = getSafeNextPath(searchParams.get("next"));

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = nextPath;
  redirectUrl.search = "";

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type
    });

    if (!error) {
      return applyPrivateNoStore(NextResponse.redirect(redirectUrl));
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return applyPrivateNoStore(NextResponse.redirect(redirectUrl));
    }
  }

  return redirectWithMessage(
    request,
    "/login",
    "error",
    "This confirmation link is invalid or expired. Please log in again."
  );
}
