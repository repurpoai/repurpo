import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolveBillingStatusFromEventType,
  resolveCustomerIdFromEvent,
  resolvePlanFromEvent,
  resolveTierFromEventType,
  resolveUserIdFromEvent,
  verifyStandardWebhookSignature
} from "@/lib/dodo";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function POST(request: Request) {
  const payload = await request.text();
  const webhookId = request.headers.get("webhook-id");
  const webhookSignature = request.headers.get("webhook-signature");
  const webhookTimestamp = request.headers.get("webhook-timestamp");
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim();

  if (!webhookId || !webhookSignature || !webhookTimestamp || !webhookKey) {
    return NextResponse.json({ error: "Missing webhook verification headers." }, { status: 400 });
  }

  const isValid = verifyStandardWebhookSignature({
    payload,
    secret: webhookKey,
    webhookId,
    webhookSignature,
    webhookTimestamp
  });

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let body: {
    type?: string;
    data?: Record<string, unknown>;
  };

  try {
    body = JSON.parse(payload) as {
      type?: string;
      data?: Record<string, unknown>;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const type = typeof body.type === "string" ? body.type : null;
  const data = asRecord(body.data);

  if (!type || !data) {
    return NextResponse.json({ received: true });
  }

  const supabase = createAdminClient();

  const { error: eventInsertError } = await supabase.from("billing_webhook_events").insert({
    id: webhookId,
    event_type: type
  });

  if (eventInsertError) {
    if (eventInsertError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }

    return NextResponse.json({ error: eventInsertError.message }, { status: 500 });
  }

  const userId = resolveUserIdFromEvent(data);
  const plan = resolvePlanFromEvent(data);
  const billingCustomerId = resolveCustomerIdFromEvent(data);
  const subscriptionId = typeof data.subscription_id === "string" ? data.subscription_id : null;
  const nextBillingDate = typeof data.next_billing_date === "string" ? data.next_billing_date : null;

  const nextTier = resolveTierFromEventType(type, plan);
  const updatePayload: Record<string, string | number | null> = {
    tier: nextTier,
    monthly_generation_limit: nextTier === "free" ? 5 : null,
    billing_status: resolveBillingStatusFromEventType(type)
  };

  if (billingCustomerId) {
    updatePayload.billing_customer_id = billingCustomerId;
  }

  if (subscriptionId) {
    updatePayload.billing_subscription_id = subscriptionId;
  }

  if (nextBillingDate) {
    updatePayload.billing_current_period_end = nextBillingDate;
  }

  if (userId) {
    await supabase.from("profiles").update(updatePayload).eq("id", userId);
    return NextResponse.json({ received: true });
  }

  if (billingCustomerId) {
    await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("billing_customer_id", billingCustomerId);
  }

  return NextResponse.json({ received: true });
}
