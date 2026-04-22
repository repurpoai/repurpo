import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { DashboardSkeleton } from "@/app/dashboard/_components/dashboard-skeleton";
import { DashboardContent } from "@/app/dashboard/_components/dashboard-content";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-6">
        <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.10),transparent_35%),linear-gradient(180deg,#0f172a_0%,#020617_100%)] px-4 py-4 text-slate-50 shadow-soft">
          <SiteHeader
            links={[
              { href: "/pricing", label: "Pricing" },
              { href: "/history", label: "History" },
              { href: "/profile", label: "Profile" }
            ]}
          />
        </div>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}
