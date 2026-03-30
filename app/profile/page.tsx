import { redirect } from "next/navigation";
import { Crown, Mail, Sparkles, User } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { PlanBadge } from "@/components/plan-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { getViewerContext } from "@/lib/viewer";

export default async function ProfilePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await getViewerContext();

  if (!viewer) {
    redirect("/login");
  }

  const params = (await searchParams) ?? {};
  const billingMessage = Array.isArray(params.billing) ? params.billing[0] : params.billing;
  const upgradeHref = "/pricing";

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

        <section className="min-w-0 flex-1 space-y-6">
          <Card className="border-0 bg-gradient-to-br from-slate-950 to-slate-800 text-white shadow-soft">
            <CardHeader>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-slate-200">
                <User className="h-4 w-4" />
                Profile
              </div>
              <CardTitle className="text-3xl text-white">Account overview</CardTitle>
              <CardDescription className="text-slate-300">
                Your plan, usage, and billing status.
              </CardDescription>
            </CardHeader>
          </Card>

          {billingMessage === "error" ? (
            <Card className="border-0 bg-white shadow-soft">
              <CardContent className="py-5 text-sm text-red-600">
                We could not open the Dodo Payments customer portal right now. Please try again.
              </CardContent>
            </Card>
          ) : null}

          {billingMessage === "unavailable" ? (
            <Card className="border-0 bg-white shadow-soft">
              <CardContent className="py-5 text-sm text-slate-600">
                Billing portal is only available after your paid subscription has been activated.
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-0 bg-white shadow-soft">
            <CardHeader>
              <CardTitle>Identity</CardTitle>
              <CardDescription>Your account info and current plan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="mt-1 h-4 w-4 text-slate-500" />
                <div>
                  <div className="text-sm text-slate-500">Email</div>
                  <div className="font-medium text-slate-900">{viewer.email ?? "—"}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Crown className="mt-1 h-4 w-4 text-slate-500" />
                <div className="space-y-2">
                  <div className="text-sm text-slate-500">Current plan</div>
                  <PlanBadge tier={viewer.tier} />
                  <div className="text-sm text-slate-500">
                    Billing status: <span className="font-medium text-slate-900 capitalize">{viewer.billingStatus.replace("_", " ")}</span>
                  </div>
                  {viewer.billingCurrentPeriodEnd ? (
                    <div className="text-sm text-slate-500">
                      Current paid period ends: <span className="font-medium text-slate-900">{formatDateTime(viewer.billingCurrentPeriodEnd)}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Sparkles className="mt-1 h-4 w-4 text-slate-500" />
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-slate-500">Text usage this month</div>
                    <div className="font-medium text-slate-900">
                      {viewer.monthlyLimit === null
                        ? "Unlimited text generations"
                        : `${viewer.usedThisMonth}/${viewer.monthlyLimit} used`}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">Image usage this month</div>
                    <div className="font-medium text-slate-900">
                      {viewer.imageMonthlyLimit === null
                        ? "Unlimited images"
                        : `${viewer.imageUsedThisMonth}/${viewer.imageMonthlyLimit} used`}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {viewer.tier === "free" ? (
                  <a
                    href={upgradeHref}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Upgrade
                  </a>
                ) : null}

                {viewer.billingCustomerId ? (
                  <a
                    href="/api/customer-portal"
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                  >
                    Manage billing
                  </a>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
