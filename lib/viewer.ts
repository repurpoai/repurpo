import { createClient } from "@/lib/supabase/server";
import {
  getImageMonthlyLimitForTier,
  getMonthRange,
  getMonthlyLimitForTier,
  normalizeTier,
  type PlanTier
} from "@/lib/plans";
import { isBlockActive } from "@/lib/account-status";

type JwtAppMetadata = {
  is_admin?: boolean;
  is_blocked?: boolean;
  role?: string;
  block_reason?: string | null;
  blocked_until?: string | null;
};

export type ViewerDraft = {
  inputType: "link" | "text" | "youtube";
  rawContent: string;
  settingsJson: Record<string, unknown>;
  updatedAt: string;
};

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
  latestDraft: ViewerDraft | null;
};

function normalizeInputType(value: unknown): "link" | "text" | "youtube" {
  if (value === "link" || value === "youtube") return value;
  return "text";
}

function readAppMetadata(claimsData: unknown): JwtAppMetadata {
  const claims = claimsData as {
    claims?: {
      app_metadata?: Record<string, unknown>;
      user_metadata?: Record<string, unknown>;
    };
  } | null;

  return ((claims?.claims?.app_metadata ?? claims?.claims?.user_metadata ?? {}) as JwtAppMetadata) ?? {};
}

export async function getViewerContext(): Promise<ViewerContext | null> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const emailClaim = claimsData?.claims?.email;
  const email = typeof emailClaim === "string" ? emailClaim : null;
  const appMetadata = readAppMetadata(claimsData);

  const profilePromise = supabase
    .from("profiles")
    .select(
      "full_name, role, tier, monthly_generation_limit, billing_status, billing_customer_id, billing_subscription_id, billing_current_period_end"
    )
    .eq("id", userId)
    .maybeSingle();

  const draftPromise = supabase
    .from("drafts")
    .select("input_type, raw_content, settings_json, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  const { startIso, endIso, label } = getMonthRange();

  const generationCountPromise = supabase
    .from("generations")
    .select("id", { count: "planned", head: true })
    .eq("user_id", userId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  const imageCountPromise = supabase
    .from("image_generations")
    .select("id", { count: "planned", head: true })
    .eq("user_id", userId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  const [{ data: profile }, { data: latestDraftRow }, { count: generationCount }, { count: imageCount }] =
    await Promise.all([profilePromise, draftPromise, generationCountPromise, imageCountPromise]);

  const tier = normalizeTier(profile?.tier);
  const monthlyLimit = getMonthlyLimitForTier(
    tier,
    typeof profile?.monthly_generation_limit === "number" ? profile.monthly_generation_limit : null
  );
  const imageMonthlyLimit = getImageMonthlyLimitForTier(tier);

  const usedThisMonth = generationCount ?? 0;
  const remainingThisMonth = monthlyLimit === null ? null : Math.max(monthlyLimit - usedThisMonth, 0);

  const imageUsedThisMonth = imageCount ?? 0;
  const imageRemainingThisMonth =
    imageMonthlyLimit === null ? null : Math.max(imageMonthlyLimit - imageUsedThisMonth, 0);

  const billingStatus =
    profile?.billing_status === "active" ||
    profile?.billing_status === "past_due" ||
    profile?.billing_status === "canceled"
      ? profile.billing_status
      : "inactive";

  const role = appMetadata.is_admin === true || appMetadata.role === "admin" || profile?.role === "admin" ? "admin" : "user";
  const isBlocked = isBlockActive(appMetadata.is_blocked ?? false, appMetadata.blocked_until);

  return {
    userId,
    email,
    userName: profile?.full_name ?? null,
    role,
    isAdmin: role === "admin",
    isBlocked,
    blockReason: typeof appMetadata.block_reason === "string" ? appMetadata.block_reason : null,
    blockedUntil: typeof appMetadata.blocked_until === "string" ? appMetadata.blocked_until : null,
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
    isPro: tier === "pro",
    latestDraft: latestDraftRow
      ? {
          inputType: normalizeInputType(latestDraftRow.input_type),
          rawContent: latestDraftRow.raw_content,
          settingsJson: (latestDraftRow.settings_json as Record<string, unknown>) ?? {},
          updatedAt: latestDraftRow.updated_at
        }
      : null
  };
}
