import Link from "next/link";
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
      <SiteHeader links={[{ href: "/", label: "Home" }, { href: "/login", label: "Log in" }, { href: "/pricing", label: "Pricing" }]} />

      <div className="mx-auto flex flex-1 items-center justify-center py-10">
        <div className="flex w-full max-w-2xl flex-col items-center justify-center rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-soft backdrop-blur">
          <ShieldAlert className="h-12 w-12 text-amber-300" />
          <p className="mt-4 text-sm uppercase tracking-[0.3em] text-amber-300">Access paused</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">Your account is blocked</h1>
          <p className="mt-4 max-w-xl text-slate-300">
            {reason || "You cannot use the app right now. If this feels wrong, check your email or contact support."}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              Back to home
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
