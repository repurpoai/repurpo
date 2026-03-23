import { createClient } from "@/lib/supabase/server";
import { getMonthRange, getMonthlyLimitForTier, normalizeTier, type PlanTier } from "@/lib/plans";

export type ViewerContext = {
  userId: string;
  email: string | null;
  userName: string | null;
  tier: PlanTier;
  monthlyLimit: number | null;
  usedThisMonth: number;
  remainingThisMonth: number | null;
  usageWindowLabel: string;
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
    .select("full_name, tier, monthly_generation_limit")
    .eq("id", userId)
    .maybeSingle();

  const tier = normalizeTier(profile?.tier);
  const monthlyLimit = getMonthlyLimitForTier(
    tier,
    typeof profile?.monthly_generation_limit === "number"
      ? profile.monthly_generation_limit
      : null
  );

  const { startIso, endIso, label } = getMonthRange();

  const { count } = await supabase
    .from("generations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  const usedThisMonth = count ?? 0;
  const remainingThisMonth =
    monthlyLimit === null ? null : Math.max(monthlyLimit - usedThisMonth, 0);

  return {
    userId,
    email,
    userName: profile?.full_name ?? null,
    tier,
    monthlyLimit,
    usedThisMonth,
    remainingThisMonth,
    usageWindowLabel: label,
    isPaid: tier !== "free",
    isPro: tier === "pro"
  };
}