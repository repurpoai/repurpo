import { redirect } from "next/navigation";
import { Crown, Mail, Sparkles, User } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { PlanBadge } from "@/components/plan-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getViewerContext } from "@/lib/viewer";

export default async function ProfilePage() {
  const viewer = await getViewerContext();

  if (!viewer) {
    redirect("/login");
  }

  const upgradeHref = process.env.NEXT_PUBLIC_PRO_UPGRADE_URL?.trim() || "/pricing";

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

        <section className="min-w-0 flex-1 space-y-6">
          <Card className="border-0 bg-gradient-to-br from-slate-950 to-slate-800 text-white shadow-soft">
            <CardHeader>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-slate-200">
                <User className="h-4 w-4" />
                Profile
              </div>
              <CardTitle className="text-3xl text-white">Account overview</CardTitle>
              <CardDescription className="text-slate-300">
                Your plan, usage, and upgrade status.
              </CardDescription>
            </CardHeader>
          </Card>

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
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Sparkles className="mt-1 h-4 w-4 text-slate-500" />
                <div>
                  <div className="text-sm text-slate-500">Usage this month</div>
                  <div className="font-medium text-slate-900">
                    {viewer.monthlyLimit === null
                      ? "Unlimited generations"
                      : `${viewer.usedThisMonth}/${viewer.monthlyLimit} used`}
                  </div>
                </div>
              </div>

              {viewer.tier === "free" ? (
                <a
                  href={upgradeHref}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Upgrade
                </a>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}