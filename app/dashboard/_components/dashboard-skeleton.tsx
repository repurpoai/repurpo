export function DashboardSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 lg:flex-row lg:p-6" aria-busy="true" aria-live="polite">
      <aside className="w-full lg:w-[19rem]">
        <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-soft lg:sticky lg:top-6">
          <div className="h-14 rounded-2xl bg-white/10" />
          <div className="space-y-3">
            <div className="h-5 w-28 rounded-full bg-white/10" />
            <div className="h-8 w-40 rounded-full bg-white/10" />
            <div className="h-4 w-full rounded-full bg-white/10" />
          </div>
          <div className="space-y-3">
            <div className="h-24 rounded-2xl bg-white/10" />
            <div className="h-24 rounded-2xl bg-white/10" />
          </div>
          <div className="h-11 rounded-2xl bg-white/10" />
        </div>
      </aside>

      <section className="min-w-0 flex-1 space-y-4">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-soft sm:p-5">
          <div className="h-6 w-56 rounded-full bg-white/10" />
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/60 p-4">
              <div className="h-5 w-32 rounded-full bg-white/10" />
              <div className="h-12 rounded-2xl bg-white/10" />
              <div className="h-12 rounded-2xl bg-white/10" />
              <div className="h-36 rounded-2xl bg-white/10" />
            </div>
            <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/60 p-4">
              <div className="h-5 w-40 rounded-full bg-white/10" />
              <div className="h-12 rounded-2xl bg-white/10" />
              <div className="h-12 rounded-2xl bg-white/10" />
              <div className="h-48 rounded-2xl bg-white/10" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
