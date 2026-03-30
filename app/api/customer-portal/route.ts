import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDodoBaseUrl, getPortalReturnUrl } from "@/lib/dodo";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (!userId) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("billing_customer_id, tier")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.billing_customer_id || profile.tier === "free") {
      const profileUrl = new URL("/profile", request.url);
      profileUrl.searchParams.set("billing", "unavailable");
      return NextResponse.redirect(profileUrl);
    }

    const apiKey = process.env.DODO_PAYMENTS_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("Missing Dodo Payments API key.");
    }

    const origin = new URL(request.url).origin;
    const portalUrl = new URL(
      `${getDodoBaseUrl()}/customers/${profile.billing_customer_id}/customer-portal/session`
    );
    portalUrl.searchParams.set("return_url", getPortalReturnUrl(origin));

    const response = await fetch(portalUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    const payload = (await response.json().catch(() => null)) as { link?: string; message?: string } | null;

    if (!response.ok || !payload?.link) {
      const profileUrl = new URL("/profile", request.url);
      profileUrl.searchParams.set("billing", "error");
      return NextResponse.redirect(profileUrl);
    }

    return NextResponse.redirect(payload.link);
  } catch {
    const profileUrl = new URL("/profile", request.url);
    profileUrl.searchParams.set("billing", "error");
    return NextResponse.redirect(profileUrl);
  }
}
