import { createClient } from "@/lib/supabase/server";
import {
  getImageMonthlyLimitForTier,
  getMonthRange,
  getMonthlyLimitForTier,
  normalizeTier,
  type PlanTier
} from "@/lib/plans";

export type ViewerContext = {
  userId: string;
  email: string | null;
  userName: string | null;
  tier: PlanTier;
  monthlyLimit: number | null;
  usedThisMonth: number;
  remainingThisMonth: number | null;
  imageMonthlyLimit: number | null;
  imageUsedThisMonth: number;
  imageRemainingThisMonth: number | null;
  usageWindowLabel: string;
  billingStatus: "inactive" | "active" | "past_due" | "canceled";
  billingCustomerId: string | null;
  billingSubscriptionId: string | null;
  billingCurrentPeriodEnd: string | null;
  isPaid: boolean;
  isPro: boolean;
};

export async function getViewerContext(): Promise<ViewerContext | null> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const email =
    typeof claimsData.claims?.email === "string" ? claimsData.claims.email : null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, tier, monthly_generation_limit, billing_status, billing_customer_id, billing_subscription_id, billing_current_period_end"
    )
    .eq("id", userId)
    .maybeSingle();

  const tier = normalizeTier(profile?.tier);
  const monthlyLimit = getMonthlyLimitForTier(
    tier,
    typeof profile?.monthly_generation_limit === "number"
      ? profile.monthly_generation_limit
      : null
  );
  const imageMonthlyLimit = getImageMonthlyLimitForTier(tier);

  const { startIso, endIso, label } = getMonthRange();

  const [{ count: generationCount }, { count: imageCount }] = await Promise.all([
    supabase
      .from("generations")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startIso)
      .lt("created_at", endIso),
    supabase
      .from("image_generations")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startIso)
      .lt("created_at", endIso)
  ]);

  const usedThisMonth = generationCount ?? 0;
  const remainingThisMonth =
    monthlyLimit === null ? null : Math.max(monthlyLimit - usedThisMonth, 0);

  const imageUsedThisMonth = imageCount ?? 0;
  const imageRemainingThisMonth =
    imageMonthlyLimit === null ? null : Math.max(imageMonthlyLimit - imageUsedThisMonth, 0);

  const billingStatus =
    profile?.billing_status === "active" ||
    profile?.billing_status === "past_due" ||
    profile?.billing_status === "canceled"
      ? profile.billing_status
      : "inactive";

  return {
    userId,
    email,
    userName: profile?.full_name ?? null,
    tier,
    monthlyLimit,
    usedThisMonth,
    remainingThisMonth,
    imageMonthlyLimit,
    imageUsedThisMonth,
    imageRemainingThisMonth,
    usageWindowLabel: label,
    billingStatus,
    billingCustomerId: typeof profile?.billing_customer_id === "string" ? profile.billing_customer_id : null,
    billingSubscriptionId:
      typeof profile?.billing_subscription_id === "string" ? profile.billing_subscription_id : null,
    billingCurrentPeriodEnd:
      typeof profile?.billing_current_period_end === "string" ? profile.billing_current_period_end : null,
    isPaid: tier !== "free",
    isPro: tier === "pro"
  };
}
