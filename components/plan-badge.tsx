import { Crown } from "lucide-react";
import { type PlanTier } from "@/lib/plans";

type PlanBadgeProps = {
  tier: PlanTier;
};

export function PlanBadge({ tier }: PlanBadgeProps) {
  if (tier === "pro") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
        <Crown className="h-3.5 w-3.5" />
        Pro
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
      Free
    </span>
  );
}