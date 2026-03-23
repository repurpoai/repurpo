export const PLAN_TIERS = ["free", "plus", "pro"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const TONES = ["professional", "casual", "viral", "authority"] as const;
export type ContentTone = (typeof TONES)[number];

export const LENGTH_PRESETS = ["short", "medium", "long"] as const;
export type LengthPreset = (typeof LENGTH_PRESETS)[number];

export const CONTENT_PLATFORMS = [
  "linkedin",
  "x",
  "instagram",
  "reddit",
  "newsletter"
] as const;
export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];

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
    description: "Hook-first, punchy, and attention-optimized.",
    proOnly: true
  },
  authority: {
    label: "Authority",
    description: "Confident, expert-led, and insight-heavy.",
    proOnly: true
  }
};

export const LENGTH_META: Record<
  LengthPreset,
  {
    label: string;
    description: string;
  }
> = {
  short: {
    label: "Short",
    description: "Tighter, faster, and more compact."
  },
  medium: {
    label: "Medium",
    description: "Balanced for most publishing workflows."
  },
  long: {
    label: "Long",
    description: "More depth, detail, and narrative room."
  }
};

export const PLATFORM_META: Record<
  ContentPlatform,
  {
    label: string;
    description: string;
  }
> = {
  linkedin: {
    label: "LinkedIn",
    description: "Professional, polished social post."
  },
  x: {
    label: "X / Twitter",
    description: "Fast-paced thread or compact post sequence."
  },
  instagram: {
    label: "Instagram",
    description: "Caption-first, hook-led, visual-friendly copy."
  },
  reddit: {
    label: "Reddit",
    description: "More natural, human, and discussion-ready."
  },
  newsletter: {
    label: "Newsletter",
    description: "Email-style long-form or concise editorial draft."
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
      "Professional tone only",
      "Link, text, and YouTube input",
      "Multi-platform generation",
      "History saving"
    ]
  },
  plus: {
    label: "Plus",
    badgeLabel: "Plus",
    priceLabel: "$12/mo",
    description: "Built for creators who want faster output and visuals.",
    features: [
      "Unlimited text generations",
      "All tones",
      "Image generation unlocked",
      "YouTube transcript mode",
      "Multi-platform workflow"
    ]
  },
  pro: {
    label: "Pro",
    badgeLabel: "Pro",
    priceLabel: "$24/mo",
    description: "For power users who want the full creation stack.",
    features: [
      "Everything in Plus",
      "Image generation unlocked",
      "Best future upgrade path",
      "Full multi-platform workflow",
      "Premium positioning"
    ]
  }
};

export function normalizeTier(value: string | null | undefined): PlanTier {
  if (value === "plus") return "plus";
  if (value === "pro") return "pro";
  return "free";
}

export function normalizeTone(value: unknown): ContentTone {
  return TONES.includes(value as ContentTone) ? (value as ContentTone) : "professional";
}

export function normalizeLengthPreset(value: unknown): LengthPreset {
  return LENGTH_PRESETS.includes(value as LengthPreset) ? (value as LengthPreset) : "medium";
}

export function normalizePlatforms(values: unknown[]): ContentPlatform[] {
  const unique = Array.from(
    new Set(values.map((value) => String(value)).filter((value) => CONTENT_PLATFORMS.includes(value as ContentPlatform)))
  ) as ContentPlatform[];

  return unique;
}

export function canUseTone(tier: PlanTier, tone: ContentTone) {
  if (tier === "free") return tone === "professional";
  return true;
}

export function isImageUnlocked(tier: PlanTier) {
  return tier !== "free";
}

export function getMonthlyLimitForTier(tier: PlanTier, storedLimit?: number | null) {
  if (tier === "free") return storedLimit ?? FREE_TIER_MONTHLY_LIMIT;
  return null;
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