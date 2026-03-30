import crypto from "node:crypto";
import { z } from "zod";
import type { PlanTier } from "@/lib/plans";

export const BILLABLE_PLANS = ["plus", "pro"] as const;
export type BillablePlan = (typeof BILLABLE_PLANS)[number];

export const checkoutPlanSchema = z.object({
  plan: z.enum(BILLABLE_PLANS)
});

export function isBillablePlan(value: unknown): value is BillablePlan {
  return BILLABLE_PLANS.includes(value as BillablePlan);
}

export function getDodoEnvironment() {
  return process.env.DODO_PAYMENTS_ENVIRONMENT === "test_mode" ? "test_mode" : "live_mode";
}

export function getDodoBaseUrl() {
  return getDodoEnvironment() === "test_mode"
    ? "https://test.dodopayments.com"
    : "https://live.dodopayments.com";
}

export function getDodoReturnUrl(origin?: string) {
  const configured = process.env.DODO_PAYMENTS_RETURN_URL?.trim();
  if (configured) return configured;
  return `${origin ?? "http://localhost:3000"}/checkout/success`;
}

export function getDodoPlanProductId(plan: BillablePlan) {
  const productId =
    plan === "plus"
      ? process.env.DODO_PAYMENTS_PLUS_PRODUCT_ID?.trim()
      : process.env.DODO_PAYMENTS_PRO_PRODUCT_ID?.trim();

  if (!productId) {
    throw new Error(`Missing Dodo Payments product ID for ${plan}.`);
  }

  return productId;
}

export function resolvePlanFromProductId(productId: string | null | undefined): BillablePlan | null {
  if (!productId) return null;

  const plusProductId = process.env.DODO_PAYMENTS_PLUS_PRODUCT_ID?.trim();
  const proProductId = process.env.DODO_PAYMENTS_PRO_PRODUCT_ID?.trim();

  if (plusProductId && productId === plusProductId) return "plus";
  if (proProductId && productId === proProductId) return "pro";
  return null;
}

export function resolvePlanFromEvent(data: Record<string, unknown>): BillablePlan | null {
  const metadata = asRecord(data.metadata);
  const metadataPlan = metadata?.plan;
  if (metadataPlan === "plus" || metadataPlan === "pro") {
    return metadataPlan;
  }

  const productId = typeof data.product_id === "string" ? data.product_id : null;
  const planFromProduct = resolvePlanFromProductId(productId);
  if (planFromProduct) return planFromProduct;

  const productCart = Array.isArray(data.product_cart) ? data.product_cart : [];
  for (const item of productCart) {
    const productId = asRecord(item)?.product_id;
    const plan = resolvePlanFromProductId(typeof productId === "string" ? productId : null);
    if (plan) return plan;
  }

  const scheduledChange = asRecord(data.scheduled_change);
  const scheduledPlan = resolvePlanFromProductId(
    typeof scheduledChange?.product_id === "string" ? scheduledChange.product_id : null
  );
  if (scheduledPlan) return scheduledPlan;

  return null;
}

export function resolveUserIdFromEvent(data: Record<string, unknown>): string | null {
  const metadata = asRecord(data.metadata);
  const metadataUserId = metadata?.user_id;
  if (typeof metadataUserId === "string" && metadataUserId) {
    return metadataUserId;
  }

  const customer = asRecord(data.customer);
  const customerMetadata = asRecord(customer?.metadata);
  const customerUserId = customerMetadata?.user_id;
  if (typeof customerUserId === "string" && customerUserId) {
    return customerUserId;
  }

  return null;
}

export function resolveCustomerIdFromEvent(data: Record<string, unknown>): string | null {
  const customer = asRecord(data.customer);
  const customerId = customer?.customer_id;
  return typeof customerId === "string" && customerId ? customerId : null;
}

export function resolveBillingStatusFromEventType(type: string): "active" | "inactive" | "past_due" | "canceled" {
  switch (type) {
    case "payment.succeeded":
    case "subscription.active":
    case "subscription.renewed":
    case "subscription.plan_changed":
    case "subscription.updated":
      return "active";
    case "subscription.on_hold":
    case "subscription.failed":
      return "past_due";
    case "subscription.cancelled":
    case "subscription.expired":
      return "canceled";
    default:
      return "inactive";
  }
}

export function resolveTierFromEventType(type: string, plan: BillablePlan | null): PlanTier {
  if (type === "subscription.cancelled" || type === "subscription.expired") {
    return "free";
  }

  if (type === "subscription.on_hold" || type === "subscription.failed") {
    return "free";
  }

  return plan ?? "free";
}

export function getPortalReturnUrl(origin?: string) {
  const configured = process.env.DODO_PAYMENTS_PORTAL_RETURN_URL?.trim();
  if (configured) return configured;
  return `${origin ?? "http://localhost:3000"}/profile`;
}

export function verifyStandardWebhookSignature({
  payload,
  secret,
  webhookId,
  webhookSignature,
  webhookTimestamp
}: {
  payload: string;
  secret: string;
  webhookId: string;
  webhookSignature: string;
  webhookTimestamp: string;
}) {
  const signedContent = `${webhookId}.${webhookTimestamp}.${payload}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(signedContent).digest("base64");

  const matches = Array.from(webhookSignature.matchAll(/v1,([^\s]+)/g)).map((match) => match[1]);
  if (matches.length === 0) {
    const fallback = webhookSignature.split(",");
    if (fallback.length >= 2 && fallback[0].trim() === "v1") {
      matches.push(fallback.slice(1).join(",").trim());
    }
  }

  return matches.some((signature) => safeCompare(signature, expectedSignature));
}

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null;
}
