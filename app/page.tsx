import Link from "next/link";
import { redirect } from "next/navigation";
import { Crown, FileText, History, Link2, Sparkles } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims?.sub) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-10">
        <header className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
            <Sparkles className="h-4 w-4" />
            User-First AI Content Repurposer
          </div>

          <div className="flex items-center gap-3">
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

        <section className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200">
              Free plan includes 5 generations/month
            </div>

            <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Repurpose one article into three polished formats, with SaaS-ready plan limits built in.
            </h1>

            <p className="max-w-2xl text-lg text-slate-300">
              Paste a URL or raw text, choose a tone, generate LinkedIn, X/Twitter, and newsletter
              outputs, then save everything to private history.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-2xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                Start free
              </Link>
              <Link
                href="/pricing"
                className="rounded-2xl border border-white/10 px-5 py-3 font-medium text-slate-100 transition hover:bg-white/5"
              >
                View pricing
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            <Card className="border-white/10 bg-white/5 text-white shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Robust extraction
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Server-side fetch + jsdom + Readability for clean source text.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-white/10 bg-white/5 text-white shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Tone-aware generation
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Professional on Free. Casual, Viral, and Authority on Pro.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-white/10 bg-white/5 text-white shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Private saved history
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Every generation is tied to the user account that created it.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-white/10 bg-white/5 text-white shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5" />
                  Monetization ready
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Tier-aware schema, monthly usage caps, pricing page, and upgrade CTAs.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}