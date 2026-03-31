import { createClient } from "@/lib/supabase/server";
import { assertTrustedOrigin, jsonNoStore } from "@/lib/http-security";
import { checkoutPlanSchema, getDodoBaseUrl, getDodoPlanProductId, getDodoReturnUrl } from "@/lib/dodo";

export async function POST(request: Request) {
  try {
    const trustedOrigin = assertTrustedOrigin(request);
    if (!trustedOrigin.ok) {
      return trustedOrigin.response;
    }

    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();

    const userId = claimsData?.claims?.sub;
    const email = typeof claimsData?.claims?.email === "string" ? claimsData.claims.email : null;

    if (!userId) {
      return jsonNoStore({ error: "Please log in before starting checkout." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = checkoutPlanSchema.safeParse(body);

    if (!parsed.success) {
      return jsonNoStore({ error: "Choose a valid plan." }, { status: 400 });
    }

    const plan = parsed.data.plan;
    const productId = getDodoPlanProductId(plan);

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name, tier")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.tier === plan) {
      return jsonNoStore({ error: `You are already on the ${plan} plan.` }, { status: 409 });
    }

    if (profile?.tier === "pro" && plan === "plus") {
      return jsonNoStore(
        { error: "Your current Pro plan already includes everything in Plus." },
        { status: 409 }
      );
    }

    const apiKey = process.env.DODO_PAYMENTS_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("Missing Dodo Payments API key.");
    }

    const origin = new URL(request.url).origin;
    const checkoutResponse = await fetch(`${getDodoBaseUrl()}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        product_cart: [
          {
            product_id: productId,
            quantity: 1
          }
        ],
        customer: {
          email: profile?.email ?? email ?? undefined,
          name: profile?.full_name ?? undefined
        },
        metadata: {
          user_id: userId,
          plan
        },
        return_url: getDodoReturnUrl(origin),
        cancel_url: `${origin}/checkout/cancel`
      })
    });

    const payload = (await checkoutResponse.json().catch(() => null)) as
      | { checkout_url?: string; message?: string }
      | null;

    if (!checkoutResponse.ok || !payload?.checkout_url) {
      return jsonNoStore(
        {
          error:
            payload?.message ||
            "Dodo Payments could not create a checkout session right now."
        },
        { status: checkoutResponse.status || 500 }
      );
    }

    return jsonNoStore({ checkoutUrl: payload.checkout_url });
  } catch (error) {
    return jsonNoStore(
      {
        error: error instanceof Error ? error.message : "Could not start checkout."
      },
      { status: 500 }
    );
  }
}
