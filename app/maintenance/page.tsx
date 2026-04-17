import Link from "next/link";

export default function MaintenancePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-50">
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center backdrop-blur">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">Under maintenance</p>
        <h1 className="mt-3 text-4xl font-semibold text-white">We&#39;ll be back soon</h1>
        <p className="mt-4 max-w-xl text-slate-300">
          The app is temporarily paused while we fix a security or reliability issue. Please try again later.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
