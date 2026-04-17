import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Crown,
  History,
  Layers3,
  Link2,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

const featureCards = [
  {
    icon: Link2,
    title: "Robust extraction",
    description: "Server-side fetch + jsdom + Readability pull clean source text from articles before generation starts.",
  },
  {
    icon: Wand2,
    title: "Tone-aware generation",
    description: "Go from professional and polished to casual, viral, or authority-style outputs without rewriting everything yourself.",
  },
  {
    icon: History,
    title: "Private saved history",
    description: "Each generation stays tied to the account that created it, so users can revisit past outputs with confidence.",
  },
  {
    icon: Crown,
    title: "Monetization ready",
    description: "Plans, usage caps, pricing, upgrade prompts, and private history are already built into the product flow.",
  },
] as const;

const workflowSteps = [
  {
    title: "Drop in a source",
    description: "Paste an article URL, YouTube link, or raw text. Repurpo extracts and cleans the source before generation.",
  },
  {
    title: "Choose platform + tone",
    description: "Pick LinkedIn, X, Instagram, Reddit, newsletter, and adjust tone, length, and output style.",
  },
  {
    title: "Generate, save, reuse",
    description: "Get ready-to-post drafts, keep them in private history, and come back anytime to copy or export.",
  },
] as const;

const highlights = [
  "URL, YouTube, and text input support",
  "Private user-linked generation history",
  "Clean mobile-first dashboard flow",
  "Free plan for trying the product fast",
] as const;

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims?.sub) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-x-0 top-0 -z-10 h-[30rem] bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.18),transparent_40%),radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_28%)]" />

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 sm:px-6 sm:py-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 backdrop-blur">
            <Sparkles className="h-4 w-4 text-emerald-300" />
            Repurpo
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Link
              href="/pricing"
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/5"
            >
              Pricing
            </Link>
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

        <section className="grid flex-1 items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              Free plan includes 5 generations every month
            </div>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl sm:leading-tight lg:text-6xl">
                Turn one source into a full stack of <span className="text-emerald-300">platform-ready content</span>.
              </h1>

              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Repurpo helps creators, marketers, founders, and students transform articles, transcripts, and rough text drafts into polished posts for LinkedIn, X, Instagram, Reddit, and newsletters — all from one workflow.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                Start free
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 px-5 py-3 font-medium text-slate-100 transition hover:bg-white/5"
              >
                View pricing
              </Link>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                "Article URLs",
                "YouTube transcripts",
                "Raw text drafts",
                "Private history",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              {highlights.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                  <p className="text-sm leading-6 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-emerald-500/5 backdrop-blur sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-emerald-300">How it feels</p>
                  <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">One source, many polished outputs</h2>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <Layers3 className="h-6 w-6 text-emerald-300" />
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-200">Input</p>
                  <p className="mt-2 text-sm leading-6 text-slate-100">
                    Blog link, YouTube URL, or your own draft text.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Platforms</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-slate-200">
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-sm">LinkedIn</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-sm">X</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-sm">Instagram</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-sm">Reddit</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Controls</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {['Professional', 'Casual', 'Authority', 'Short-form'].map((item) => (
                        <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Result</p>
                  <div className="mt-3 space-y-3">
                    {[
                      'Cleaner source extraction before generation',
                      'Platform-specific drafts that are easier to post as-is',
                      'Private history so users can revisit earlier outputs',
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                        <p className="text-sm leading-6 text-slate-200">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6 py-6 sm:py-10">
          <div className="max-w-2xl space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-emerald-300">Core strengths</p>
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">A more convincing landing page, without losing clarity</h2>
            <p className="text-slate-300">
              The product already has useful features. This section simply shows them better, with clearer value and stronger visual hierarchy.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="border-white/10 bg-white/5 text-white shadow-soft backdrop-blur transition hover:border-emerald-400/30 hover:bg-white/[0.07]">
                <CardHeader className="space-y-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10">
                    <Icon className="h-5 w-5 text-emerald-300" />
                  </div>
                  <CardTitle className="text-lg leading-snug text-white">{title}</CardTitle>
                  <CardDescription className="text-sm leading-6 text-slate-300">{description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-6 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-emerald-300">Workflow</p>
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">From source to publish-ready in three simple steps</h2>
            <p className="text-slate-300">
              The value is not just generation. It is the speed of going from one long source to multiple clean outputs without copy-pasting between tools.
            </p>
          </div>

          <div className="grid gap-4">
            {workflowSteps.map((step, index) => (
              <div key={step.title} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 text-sm font-bold text-slate-950">
                    0{index + 1}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="py-8 sm:py-10">
          <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/8 to-white/4 p-6 backdrop-blur sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl space-y-3">
                <p className="text-sm font-medium uppercase tracking-[0.25em] text-emerald-300">Ready to try it</p>
                <h2 className="text-2xl font-semibold text-white sm:text-3xl">Start free, test the workflow, and see your content stack build itself</h2>
                <p className="text-slate-300">
                  Try the free plan first. When users want more tones, more generations, and more flexibility, the upgrade path is already there.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
                >
                  Start free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 px-5 py-3 font-medium text-slate-100 transition hover:bg-white/5"
                >
                  Compare plans
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
