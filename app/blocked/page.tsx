import { ShieldAlert } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { SiteHeader } from "@/components/site-header";

export default async function BlockedPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const reason = Array.isArray(params.reason) ? params.reason[0] : params.reason;

  return (
    <PageShell>
      <SiteHeader className="mb-6" links={[{ href: "/", label: "Home" }, { href: "/login", label: "Log in" }, { href: "/pricing", label: "Pricing" }]} />

      <div className="mx-auto flex flex-1 items-center justify-center py-10">
        <div className="flex w-full max-w-2xl flex-col items-center justify-center rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-soft backdrop-blur">
          <ShieldAlert className="h-12 w-12 text-amber-300" />
          <p className="mt-4 text-sm uppercase tracking-[0.3em] text-amber-300">Access paused</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">Your account is blocked</h1>
          <p className="mt-4 max-w-xl text-slate-300">
            {reason || "You cannot use the app right now. If this feels wrong, check your email or contact support."}
          </p>
          <p className="mt-8 text-sm text-slate-400">This page updates automatically when access is restored.</p>
        </div>
      </div>
    </PageShell>
  );
}
