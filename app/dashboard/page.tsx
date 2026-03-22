import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { DashboardGenerator } from "@/app/dashboard/_components/dashboard-generator";
import { getViewerContext } from "@/lib/viewer";

export default async function DashboardPage() {
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
        <section className="min-w-0 flex-1">
          <DashboardGenerator
            tier={viewer.tier}
            usedThisMonth={viewer.usedThisMonth}
            monthlyLimit={viewer.monthlyLimit}
            remainingThisMonth={viewer.remainingThisMonth}
            usageWindowLabel={viewer.usageWindowLabel}
            upgradeHref={upgradeHref}
          />
        </section>
      </div>
    </main>
  );
}