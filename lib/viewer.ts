import { createClient } from "@/lib/supabase/server";
import {
  getImageMonthlyLimitForTier,
  getMonthRange,
  getMonthlyLimitForTier,
  normalizeTier,
  type PlanTier
} from "@/lib/plans";
import { isBlockActive } from "@/lib/account-status";

export type ViewerContext = {
  userId: string;
  email: string | null;
  userName: string | null;
  role: "user" | "admin";
  isAdmin: boolean;
  isBlocked: boolean;
  blockReason: string | null;
  blockedUntil: string | null;
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

  const emailClaim = claimsData?.claims?.email;
  const email = typeof emailClaim === "string" ? emailClaim : null;

  const profilePromise = supabase
    .from("profiles")
    .select(
      "full_name, role, is_blocked, block_reason, blocked_until, tier, monthly_generation_limit, billing_status, billing_customer_id, billing_subscription_id, billing_current_period_end"
    )
    .eq("id", userId)
    .maybeSingle();

  const { startIso, endIso, label } = getMonthRange();

  const generationCountPromise = supabase
    .from("generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  const imageCountPromise = supabase
    .from("image_generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  const [{ data: profile }, { count: generationCount }, { count: imageCount }] = await Promise.all([
    profilePromise,
    generationCountPromise,
    imageCountPromise
  ]);

  const tier = normalizeTier(profile?.tier);
  const monthlyLimit = getMonthlyLimitForTier(
    tier,
    typeof profile?.monthly_generation_limit === "number"
      ? profile.monthly_generation_limit
      : null
  );
  const imageMonthlyLimit = getImageMonthlyLimitForTier(tier);

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

  const role = profile?.role === "admin" ? "admin" : "user";
  const isBlocked = isBlockActive(profile?.is_blocked, profile?.blocked_until);

  return {
    userId,
    email,
    userName: profile?.full_name ?? null,
    role,
    isAdmin: role === "admin",
    isBlocked,
    blockReason: typeof profile?.block_reason === "string" ? profile.block_reason : null,
    blockedUntil: typeof profile?.blocked_until === "string" ? profile.blocked_until : null,
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
