import Link from "next/link";
import { Crown, Sparkles } from "lucide-react";
import { CheckoutButton } from "@/components/checkout-button";
import { PlanBadge } from "@/components/plan-badge";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLAN_META } from "@/lib/plans";
import { getViewerContext } from "@/lib/viewer";

export default async function PricingPage() {
  const viewer = await getViewerContext();

  const pricingContent = (
    <div className="space-y-6">
      <Card className="border-0 bg-gradient-to-br from-slate-950 to-slate-800 text-white shadow-soft">
        <CardHeader>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-slate-200">
            <Crown className="h-4 w-4" />
            Pricing
          </div>
          <CardTitle className="text-3xl text-white">Free, Plus, and Pro</CardTitle>
          <CardDescription className="text-slate-300">
            Free gets 1 image a month, Plus gets 5, and Pro removes the cap. Paid plans are activated automatically after Dodo Payments confirms the subscription.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        {(["free", "plus", "pro"] as const).map((tier) => (
          <Card
            key={tier}
            className={`border-0 bg-white shadow-soft ${
              tier === "plus" ? "ring-2 ring-slate-950/10" : ""
            }`}
          >
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{PLAN_META[tier].label}</CardTitle>
                <PlanBadge tier={tier} />
              </div>
              <div className="text-3xl font-semibold text-slate-950">{PLAN_META[tier].priceLabel}</div>
              <CardDescription>{PLAN_META[tier].description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {PLAN_META[tier].features.map((feature) => (
                <div key={feature} className="flex items-start gap-3 text-sm text-slate-700">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                  {feature}
                </div>
              ))}

              <div className="pt-4">
                {viewer?.tier === tier ? (
                  <div className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900">
                    Current plan
                  </div>
                ) : tier === "free" ? (
                  <Link
                    href={viewer ? "/dashboard" : "/signup"}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                  >
                    {viewer ? "Back to dashboard" : "Start free"}
                  </Link>
                ) : viewer?.tier === "pro" && tier === "plus" ? (
                  <div className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-500">
                    Included in Pro
                  </div>
                ) : viewer ? (
                  <CheckoutButton
                    plan={tier}
                    label={tier === "plus" ? "Buy Plus" : viewer.tier === "plus" ? "Upgrade to Pro" : "Buy Pro"}
                  />
                ) : (
                  <Link
                    href="/signup"
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Sign up to continue
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  if (viewer) {
    return (
      <main className="min-h-screen bg-slate-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 lg:flex-row lg:p-6">
          <Sidebar
            userName={viewer.userName}
            userEmail={viewer.email}
            tier={viewer.tier}
            usedThisMonth={viewer.usedThisMonth}
            monthlyLimit={viewer.monthlyLimit}
            remainingThisMonth={viewer.remainingThisMonth}
            imageUsedThisMonth={viewer.imageUsedThisMonth}
            imageMonthlyLimit={viewer.imageMonthlyLimit}
            imageRemainingThisMonth={viewer.imageRemainingThisMonth}
            usageWindowLabel={viewer.usageWindowLabel}
          />
          <section className="min-w-0 flex-1">{pricingContent}</section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
            <Crown className="h-4 w-4" />
            Pricing
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/5"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              Sign up
            </Link>
          </div>
        </header>

        <section className="py-12">{pricingContent}</section>
      </div>
    </main>
  );
}
