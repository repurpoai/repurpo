export const PLAN_TIERS = ["free", "pro"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const TONES = ["professional", "casual", "viral", "authority"] as const;
export type ContentTone = (typeof TONES)[number];

export const FREE_TIER_MONTHLY_LIMIT = 5;

export const TONE_META: Record<
  ContentTone,
  {
    label: string;
    description: string;
    proOnly: boolean;
  }
> = {
  professional: {
    label: "Professional",
    description: "Clear, polished, credible, and business-ready.",
    proOnly: false
  },
  casual: {
    label: "Casual",
    description: "Relaxed, friendly, and easy to skim.",
    proOnly: true
  },
  viral: {
    label: "Viral",
    description: "Punchy, hook-first, and optimized for attention.",
    proOnly: true
  },
  authority: {
    label: "Authority",
    description: "Confident, expert-led, and insight-heavy.",
    proOnly: true
  }
};

export const PLAN_META: Record<
  PlanTier,
  {
    label: string;
    badgeLabel: string;
    priceLabel: string;
    description: string;
    features: string[];
  }
> = {
  free: {
    label: "Free",
    badgeLabel: "Free",
    priceLabel: "$0/mo",
    description: "Best for trying the product and publishing occasionally.",
    features: [
      "5 generations per month",
      "Professional tone",
      "Link extraction + text input",
      "Saved history",
      "Copy to clipboard"
    ]
  },
  pro: {
    label: "Pro",
    badgeLabel: "Pro",
    priceLabel: "$12/mo",
    description: "For creators, marketers, and founders who want full power.",
    features: [
      "Unlimited generations",
      "All tones: Professional, Casual, Viral, Authority",
      "Direct export buttons",
      "Saved history",
      "Priority-ready monetization schema"
    ]
  }
};

export function normalizeTier(value: string | null | undefined): PlanTier {
  return value === "pro" ? "pro" : "free";
}

export function normalizeTone(value: unknown): ContentTone {
  return TONES.includes(value as ContentTone) ? (value as ContentTone) : "professional";
}

export function canUseTone(tier: PlanTier, tone: ContentTone) {
  if (tier === "pro") return true;
  return tone === "professional";
}

export function getMonthlyLimitForTier(tier: PlanTier, storedLimit?: number | null) {
  if (tier === "pro") return null;
  return storedLimit ?? FREE_TIER_MONTHLY_LIMIT;
}

export function getMonthRange(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label: new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric"
    }).format(start)
  };
}