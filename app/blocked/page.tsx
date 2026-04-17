import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default async function BlockedPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const reason = Array.isArray(params.reason) ? params.reason[0] : params.reason;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-50">
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center backdrop-blur">
        <ShieldAlert className="h-12 w-12 text-amber-300" />
        <p className="mt-4 text-sm uppercase tracking-[0.3em] text-amber-300">Access paused</p>
        <h1 className="mt-3 text-4xl font-semibold text-white">Your account is blocked</h1>
        <p className="mt-4 max-w-xl text-slate-300">
          {reason || "You cannot use the app right now. If this feels wrong, check your email or contact support."}
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
        >
          Go to login
        </Link>
      </div>
    </main>
  );
}
