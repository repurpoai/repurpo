import Link from "next/link";
import { Crown, Lock, Sparkles } from "lucide-react";
import { PlanBadge } from "@/components/plan-badge";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLAN_META } from "@/lib/plans";
import { getViewerContext } from "@/lib/viewer";

export default async function PricingPage() {
  const viewer = await getViewerContext();
  const upgradeHref = process.env.NEXT_PUBLIC_PRO_UPGRADE_URL?.trim() || "/pricing";

  const pricingContent = (
    <div className="space-y-6">
      <Card className="border-0 bg-gradient-to-br from-slate-950 to-slate-800 text-white shadow-soft">
        <CardHeader className="space-y-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-slate-200">
            <Crown className="h-4 w-4" />
            Pricing
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl">Simple plans built for growth</CardTitle>
            <CardDescription className="max-w-3xl text-slate-300">
              Start free, validate demand, then monetize with a clean Free vs Pro product boundary.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      {viewer ? (
        <Card className="border-0 bg-white shadow-soft">
          <CardContent className="flex flex-col gap-3 py-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-sm text-slate-500">Current plan</p>
              <div className="flex items-center gap-2">
                <PlanBadge tier={viewer.tier} />
                <span className="text-sm text-slate-600">
                  {viewer.monthlyLimit === null
                    ? "Unlimited generations"
                    : `${viewer.usedThisMonth}/${viewer.monthlyLimit} used this month`}
                </span>
              </div>
            </div>

            {viewer.isPro ? (
              <Link
                href="/dashboard"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
              >
                Back to dashboard
              </Link>
            ) : (
              <a
                href={upgradeHref}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Upgrade to Pro
              </a>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 bg-white shadow-soft">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{PLAN_META.free.label}</CardTitle>
              <PlanBadge tier="free" />
            </div>
            <div className="text-3xl font-semibold text-slate-950">{PLAN_META.free.priceLabel}</div>
            <CardDescription>{PLAN_META.free.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {PLAN_META.free.features.map((feature) => (
              <div key={feature} className="flex items-start gap-3 text-sm text-slate-700">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                {feature}
              </div>
            ))}

            <div className="pt-4">
              {viewer ? (
                viewer.tier === "free" ? (
                  <div className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900">
                    Current plan
                  </div>
                ) : (
                  <Link
                    href="/dashboard"
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                  >
                    Back to dashboard
                  </Link>
                )
              ) : (
                <Link
                  href="/signup"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                >
                  Start free
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-slate-950 bg-white shadow-soft">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{PLAN_META.pro.label}</CardTitle>
              <PlanBadge tier="pro" />
            </div>
            <div className="text-3xl font-semibold text-slate-950">{PLAN_META.pro.priceLabel}</div>
            <CardDescription>{PLAN_META.pro.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {PLAN_META.pro.features.map((feature) => (
              <div key={feature} className="flex items-start gap-3 text-sm text-slate-700">
                <Crown className="mt-0.5 h-4 w-4 shrink-0" />
                {feature}
              </div>
            ))}

            <div className="pt-4">
              {viewer?.isPro ? (
                <div className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white">
                  Active plan
                </div>
              ) : viewer ? (
                <a
                  href={upgradeHref}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Upgrade to Pro
                </a>
              ) : (
                <Link
                  href="/signup"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Create account
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 bg-white shadow-soft">
        <CardHeader>
          <CardTitle>Feature gates that drive upgrades</CardTitle>
          <CardDescription>
            The UI shows Pro features openly, but Free users see them locked until they upgrade.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
              <Lock className="h-4 w-4" />
              Advanced tones
            </div>
            <p className="text-sm text-slate-600">
              Casual, Viral, and Authority are visible but locked on Free.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
              <Lock className="h-4 w-4" />
              Direct export
            </div>
            <p className="text-sm text-slate-600">
              Export buttons appear in history and results but stay disabled for Free users.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
              <Lock className="h-4 w-4" />
              Monthly cap
            </div>
            <p className="text-sm text-slate-600">
              Free accounts stop at 5 generations per month. Pro removes the cap.
            </p>
          </div>
        </CardContent>
      </Card>
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
            usageWindowLabel={viewer.usageWindowLabel}
          />
          <section className="min-w-0 flex-1">{pricingContent}</section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-10">
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

        <section className="py-12">
          {pricingContent}
        </section>
      </div>
    </main>
  );
}