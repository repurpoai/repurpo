"use client";

import { useActionState, useMemo, useState } from "react";
import {
  CheckCircle2,
  Crown,
  FileText,
  Link2,
  LoaderCircle,
  Lock,
  Megaphone,
  WandSparkles
} from "lucide-react";
import { generateContentAction, initialGenerationFormState } from "@/app/dashboard/actions";
import { CopyButton } from "@/components/copy-button";
import { ExportButton } from "@/components/export-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TONE_META, type ContentTone, type PlanTier } from "@/lib/plans";

const TEXT_LIMIT = 5000;
const toneOptions = Object.entries(TONE_META) as Array<
  [ContentTone, (typeof TONE_META)[ContentTone]]
>;

type DashboardGeneratorProps = {
  tier: PlanTier;
  usedThisMonth: number;
  monthlyLimit: number | null;
  remainingThisMonth: number | null;
  usageWindowLabel: string;
  upgradeHref: string;
};

export function DashboardGenerator({
  tier,
  usedThisMonth,
  monthlyLimit,
  remainingThisMonth,
  usageWindowLabel,
  upgradeHref
}: DashboardGeneratorProps) {
  const [mode, setMode] = useState<"link" | "text">("link");
  const [tone, setTone] = useState<ContentTone>("professional");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");

  const [state, formAction, pending] = useActionState(
    generateContentAction,
    initialGenerationFormState
  );

  const usage = state.usage ?? {
    tier,
    usedThisMonth,
    monthlyLimit,
    remainingThisMonth,
    usageWindowLabel
  };

  const currentTier = usage.tier;
  const atLimit = usage.monthlyLimit !== null && usage.usedThisMonth >= usage.monthlyLimit;

  const wordCount = useMemo(() => {
    const value = text.trim();
    if (!value) return 0;
    return value.split(/\s+/).length;
  }, [text]);

  const usagePercent =
    usage.monthlyLimit === null
      ? 0
      : Math.min((usage.usedThisMonth / usage.monthlyLimit) * 100, 100);

  return (
    <div className="space-y-6">
      <Card className="border-0 bg-gradient-to-br from-slate-950 to-slate-800 text-white shadow-soft">
        <CardHeader className="space-y-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-slate-200">
            <WandSparkles className="h-4 w-4" />
            New generation
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl">Create three finished outputs from one source</CardTitle>
            <CardDescription className="max-w-3xl text-slate-300">
              Use Link mode for robust article extraction or Text mode for manual input. Free users
              get 5 generations per month and Professional tone. Pro unlocks unlimited generations,
              all tones, and direct export.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-0 bg-white shadow-soft">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Plan & usage</CardTitle>
              <CardDescription>
                Usage resets every month. Limits are enforced on the server.
              </CardDescription>
            </div>

            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
              {usage.monthlyLimit === null ? (
                <div className="flex items-center gap-2 font-medium">
                  <Crown className="h-4 w-4" />
                  Pro plan • Unlimited generations
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="font-medium">
                    Free plan • {usage.usedThisMonth}/{usage.monthlyLimit} used in {usage.usageWindowLabel}
                  </div>
                  <div className="h-2 w-56 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-slate-900 transition-all"
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {usage.monthlyLimit !== null ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900">
                    {usage.remainingThisMonth} generations remaining this month
                  </p>
                  <p className="text-sm text-slate-500">
                    Upgrade to Pro for unlimited generations, advanced tones, and export buttons.
                  </p>
                </div>
                <a
                  href={upgradeHref}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Upgrade to Pro
                </a>
              </div>
            </div>
          ) : null}
        </CardHeader>
      </Card>

      <Card className="border-0 bg-white shadow-soft">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Source input</CardTitle>
              <CardDescription>Choose a mode, pick a tone, and submit your source.</CardDescription>
            </div>

            <div className="inline-flex rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode("link")}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  mode === "link"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Link mode
              </button>
              <button
                type="button"
                onClick={() => setMode("text")}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  mode === "text"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Text mode
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium text-slate-900">Tone selection</h3>
              <p className="text-sm text-slate-500">
                Different tones change the final voice and structure of the outputs.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {toneOptions.map(([toneKey, meta]) => {
                const locked = currentTier === "free" && meta.proOnly;
                const active = tone === toneKey;

                return (
                  <button
                    key={toneKey}
                    type="button"
                    disabled={locked}
                    onClick={() => setTone(toneKey)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-slate-950 bg-slate-950 text-white"
                        : locked
                        ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                        : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{meta.label}</span>
                      {locked ? (
                        <Lock className="h-4 w-4" />
                      ) : active ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : null}
                    </div>
                    <p
                      className={`mt-2 text-sm leading-6 ${
                        active ? "text-slate-200" : locked ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {meta.description}
                    </p>
                    {locked ? (
                      <div className="mt-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                        Pro only
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {currentTier === "free" ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span>Free includes Professional tone only.</span>
                <a href={upgradeHref} className="font-medium text-slate-950 underline underline-offset-4">
                  Upgrade to unlock Casual, Viral, and Authority
                </a>
              </div>
            ) : null}
          </div>

          <form action={formAction} className="space-y-5">
            <input type="hidden" name="mode" value={mode} />
            <input type="hidden" name="tone" value={tone} />

            {mode === "link" ? (
              <div className="space-y-2">
                <label htmlFor="source-url" className="text-sm font-medium text-slate-700">
                  Article URL
                </label>
                <Input
                  id="source-url"
                  name="url"
                  type="url"
                  placeholder="https://example.com/article"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  disabled={pending}
                  required={mode === "link"}
                />
                <p className="text-sm text-slate-500">
                  The app fetches the page, extracts readable content, and sends only clean text to the model.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor="source-text" className="text-sm font-medium text-slate-700">
                    Source text
                  </label>
                  <span className={`text-sm ${wordCount > TEXT_LIMIT ? "text-red-600" : "text-slate-500"}`}>
                    {wordCount}/{TEXT_LIMIT} words
                  </span>
                </div>
                <Textarea
                  id="source-text"
                  name="text"
                  placeholder="Paste your source text here..."
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  disabled={pending}
                  required={mode === "text"}
                  rows={14}
                />
                <p className="text-sm text-slate-500">
                  Server validation rejects overly short or overly long input.
                </p>
              </div>
            )}

            {state.error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {state.error}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg" disabled={pending || atLimit}>
                {pending ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : atLimit ? (
                  "Monthly limit reached"
                ) : (
                  <>
                    <WandSparkles className="h-4 w-4" />
                    Generate content
                  </>
                )}
              </Button>

              {atLimit ? (
                <a
                  href={upgradeHref}
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                >
                  Upgrade to Pro
                </a>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      {pending ? (
        <Card className="border-0 bg-white shadow-soft">
          <CardContent className="flex items-center gap-3 py-8 text-slate-700">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            Processing the source, applying tone rules, and creating three structured outputs...
          </CardContent>
        </Card>
      ) : null}

      {state.data ? (
        <div className="space-y-6">
          <Card className="border-0 bg-white shadow-soft">
            <CardHeader className="gap-3">
              <CardTitle className="text-xl">Latest result</CardTitle>
              <CardDescription>
                {state.data.inputMode === "link" ? "Link mode" : "Text mode"} •{" "}
                {TONE_META[state.data.tone].label} tone
              </CardDescription>
              <div className="text-sm font-medium text-slate-900">{state.data.sourceTitle}</div>
              {state.data.sourceUrl ? (
                <a
                  href={state.data.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="break-all text-sm font-medium text-slate-700 underline underline-offset-4"
                >
                  {state.data.sourceUrl}
                </a>
              ) : null}
            </CardHeader>
          </Card>

          <Card className="border-0 bg-white shadow-soft">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5" />
                  LinkedIn post
                </CardTitle>
                <CardDescription>Hook-led, polished, and LinkedIn-native.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CopyButton text={state.data.linkedinPost} label="Copy" />
                <ExportButton
                  text={state.data.linkedinPost}
                  filename="linkedin-post.txt"
                  disabled={!currentTier || currentTier === "free"}
                />
                {currentTier === "free" ? (
                  <a href={upgradeHref} className="text-xs font-medium text-slate-900 underline underline-offset-4">
                    Unlock export
                  </a>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {state.data.linkedinPost}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white shadow-soft">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Twitter/X thread
                </CardTitle>
                <CardDescription>Numbered, punchy, and easy to post thread-by-thread.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CopyButton text={state.data.twitterThread} label="Copy" />
                <ExportButton
                  text={state.data.twitterThread}
                  filename="twitter-thread.txt"
                  disabled={currentTier === "free"}
                />
                {currentTier === "free" ? (
                  <a href={upgradeHref} className="text-xs font-medium text-slate-900 underline underline-offset-4">
                    Unlock export
                  </a>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {state.data.twitterThread}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white shadow-soft">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Newsletter version
                </CardTitle>
                <CardDescription>Headline, summary, and readable long-form flow.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CopyButton text={state.data.newsletter} label="Copy" />
                <ExportButton
                  text={state.data.newsletter}
                  filename="newsletter.txt"
                  disabled={currentTier === "free"}
                />
                {currentTier === "free" ? (
                  <a href={upgradeHref} className="text-xs font-medium text-slate-900 underline underline-offset-4">
                    Unlock export
                  </a>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {state.data.newsletter}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}