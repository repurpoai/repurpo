"use client";

import Image from "next/image";
import { useActionState, useEffect, useMemo, useState, type ComponentType } from "react";
import {
  CheckCircle2,
  Crown,
  Download,
  FileImage,
  FileText,
  Link2,
  LoaderCircle,
  Lock,
  Megaphone,
  MessageSquareQuote,
  Newspaper,
  PlaySquare,
  WandSparkles
} from "lucide-react";
import { generateContentAction, type GenerationFormState } from "@/app/dashboard/actions";
import { CopyButton } from "@/components/copy-button";
import { ExportButton } from "@/components/export-button";
import { OpenInAppButton } from "@/components/open-in-app-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  LENGTH_META,
  PLATFORM_META,
  TONE_META,
  isImageUnlocked,
  type ContentPlatform,
  type ContentTone,
  type LengthPreset,
  type PlanTier
} from "@/lib/plans";

const TEXT_LIMIT = 5000;

const toneOptions = Object.entries(TONE_META) as Array<
  [ContentTone, (typeof TONE_META)[ContentTone]]
>;

const lengthOptions = Object.entries(LENGTH_META) as Array<
  [LengthPreset, (typeof LENGTH_META)[LengthPreset]]
>;

const platformOptions = Object.entries(PLATFORM_META) as Array<
  [ContentPlatform, (typeof PLATFORM_META)[ContentPlatform]]
>;

const initialGenerationFormState: GenerationFormState = {
  success: false,
  error: null,
  data: null,
  usage: null
};

type DashboardGeneratorProps = {
  tier: PlanTier;
  usedThisMonth: number;
  monthlyLimit: number | null;
  remainingThisMonth: number | null;
  imageUsedThisMonth: number;
  imageMonthlyLimit: number | null;
  imageRemainingThisMonth: number | null;
  usageWindowLabel: string;
  upgradeHref: string;
};

const platformIcons: Record<ContentPlatform, ComponentType<{ className?: string }>> = {
  linkedin: Megaphone,
  x: Link2,
  instagram: FileText,
  reddit: MessageSquareQuote,
  newsletter: Newspaper
};


export function DashboardGenerator({
  tier,
  usedThisMonth,
  monthlyLimit,
  remainingThisMonth,
  imageUsedThisMonth,
  imageMonthlyLimit,
  imageRemainingThisMonth,
  usageWindowLabel,
  upgradeHref
}: DashboardGeneratorProps) {
  const [mode, setMode] = useState<"link" | "text" | "youtube">("link");
  const [tone, setTone] = useState<ContentTone>("professional");
  const [lengthPreset, setLengthPreset] = useState<LengthPreset>("medium");
  const [selectedPlatforms, setSelectedPlatforms] = useState<ContentPlatform[]>([
    "linkedin",
    "x",
    "newsletter"
  ]);

  const [url, setUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [text, setText] = useState("");

  const [imagePrompt, setImagePrompt] = useState("");
  const [imageAspectRatio, setImageAspectRatio] = useState<"1:1" | "3:4" | "4:3" | "9:16" | "16:9">("1:1");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  const [state, formAction, pending] = useActionState(
    generateContentAction,
    initialGenerationFormState
  );
  const [imageUsage, setImageUsage] = useState({
    imageUsedThisMonth,
    imageMonthlyLimit,
    imageRemainingThisMonth,
    usageWindowLabel
  });
  const [draftHydrated, setDraftHydrated] = useState(false);
  const storageKey = "repurpo-generation-draft-v2";

  const usage = state.usage ?? {
    tier,
    usedThisMonth,
    monthlyLimit,
    remainingThisMonth,
    imageUsedThisMonth,
    imageMonthlyLimit,
    imageRemainingThisMonth,
    usageWindowLabel
  };

  const currentTier = usage.tier;
  const atLimit = usage.monthlyLimit !== null && usage.usedThisMonth >= usage.monthlyLimit;
  const imageUnlocked = isImageUnlocked(currentTier);
  const imageAtLimit =
    imageUsage.imageMonthlyLimit !== null &&
    imageUsage.imageUsedThisMonth >= imageUsage.imageMonthlyLimit;

  const wordCount = useMemo(() => {
    const value = text.trim();
    if (!value) return 0;
    return value.split(/\s+/).length;
  }, [text]);

  const usagePercent =
    usage.monthlyLimit === null
      ? 0
      : Math.min((usage.usedThisMonth / usage.monthlyLimit) * 100, 100);

  function togglePlatform(platform: ContentPlatform) {
    setSelectedPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform]
    );
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) {
        setDraftHydrated(true);
        return;
      }

      const parsed = JSON.parse(saved) as {
        mode?: "link" | "text" | "youtube";
        tone?: ContentTone;
        lengthPreset?: LengthPreset;
        selectedPlatforms?: ContentPlatform[];
        url?: string;
        youtubeUrl?: string;
        text?: string;
        imagePrompt?: string;
        imageAspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
      };

      if (parsed.mode === "link" || parsed.mode === "text" || parsed.mode === "youtube") {
        setMode(parsed.mode);
      }
      if (parsed.tone) setTone(parsed.tone);
      if (parsed.lengthPreset) setLengthPreset(parsed.lengthPreset);
      if (Array.isArray(parsed.selectedPlatforms) && parsed.selectedPlatforms.length > 0) {
        setSelectedPlatforms(parsed.selectedPlatforms);
      }
      if (typeof parsed.url === "string") setUrl(parsed.url);
      if (typeof parsed.youtubeUrl === "string") setYoutubeUrl(parsed.youtubeUrl);
      if (typeof parsed.text === "string") setText(parsed.text);
      if (typeof parsed.imagePrompt === "string") setImagePrompt(parsed.imagePrompt);
      if (parsed.imageAspectRatio) setImageAspectRatio(parsed.imageAspectRatio);
    } catch {
      // ignore bad drafts
    } finally {
      setDraftHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !draftHydrated) return;

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        mode,
        tone,
        lengthPreset,
        selectedPlatforms,
        url,
        youtubeUrl,
        text,
        imagePrompt,
        imageAspectRatio
      })
    );
  }, [draftHydrated, imageAspectRatio, imagePrompt, lengthPreset, mode, selectedPlatforms, text, tone, url, youtubeUrl]);

  useEffect(() => {
    if (!state.data) return;

    setImagePrompt(state.data.imagePrompt);
    setImageUsage({
      imageUsedThisMonth: usage.imageUsedThisMonth,
      imageMonthlyLimit: usage.imageMonthlyLimit,
      imageRemainingThisMonth: usage.imageRemainingThisMonth,
      usageWindowLabel: usage.usageWindowLabel
    });
    setImageUrl(null);
    setImageError(null);
  }, [state.data, usage.imageMonthlyLimit, usage.imageRemainingThisMonth, usage.imageUsedThisMonth, usage.usageWindowLabel]);



  function handleDownloadImage() {
    if (!imageUrl) return;

    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `repurpo-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleGenerateImage() {
    if (!imageUnlocked) {
      setImageError("Image generation is not available on your current plan.");
      return;
    }

    if (imageAtLimit) {
      setImageError(
        currentTier === "free"
          ? "You already used your 1 image for this month on Free."
          : "You reached your monthly image limit for Plus."
      );
      return;
    }

    if (!imagePrompt.trim()) {
      setImageError("Enter an image prompt first.");
      return;
    }

    try {
      setImageLoading(true);
      setImageError(null);
      setImageUrl(null);

      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: imagePrompt,
          aspectRatio: imageAspectRatio
        })
      });

      const result = (await response.json()) as {
        imageDataUrl?: string;
        error?: string;
        usage?: {
          imageUsedThisMonth: number;
          imageMonthlyLimit: number | null;
          imageRemainingThisMonth: number | null;
          usageWindowLabel: string;
        };
      };

      if (result.usage) {
        setImageUsage(result.usage);
      }

      if (!response.ok) {
        throw new Error(result.error || "Image generation failed.");
      }

      if (!result.imageDataUrl) {
        throw new Error("No image was returned.");
      }

      setImageUrl(result.imageDataUrl);
    } catch (error) {
      setImageError(
        error instanceof Error ? error.message : "Image generation failed."
      );
    } finally {
      setImageLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 bg-gradient-to-br from-slate-950 to-slate-800 text-white shadow-soft">
        <CardHeader className="space-y-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-slate-200">
            <WandSparkles className="h-4 w-4" />
            Version 2 builder
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl text-white">Choose platforms first, then generate</CardTitle>
            <CardDescription className="max-w-3xl text-slate-300">
              Link, text, or YouTube in. Multi-platform content out. Gemini writes the copy. Cloudflare generates the image. Every plan includes image generation with monthly limits.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <Card className="border border-white/10 bg-white/5 text-slate-50 shadow-soft backdrop-blur">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-white">Input mode</CardTitle>
              <CardDescription className="text-slate-300">Article, pasted text, or YouTube transcript.</CardDescription>
            </div>

            <div className="inline-flex rounded-xl bg-white/10 p-1">
              <button
                type="button"
                onClick={() => setMode("link")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  mode === "link"
                    ? "bg-slate-50 text-slate-950 shadow-md shadow-black/20"
                    : "text-slate-300 hover:text-white hover:bg-white/5"
                }`}
              >
                Link
              </button>
              <button
                type="button"
                onClick={() => setMode("text")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  mode === "text"
                    ? "bg-slate-50 text-slate-950 shadow-md shadow-black/20"
                    : "text-slate-300 hover:text-white hover:bg-white/5"
                }`}
              >
                Text
              </button>
              <button
                type="button"
                onClick={() => setMode("youtube")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  mode === "youtube"
                    ? "bg-slate-50 text-slate-950 shadow-md shadow-black/20"
                    : "text-slate-300 hover:text-white hover:bg-white/5"
                }`}
              >
                YouTube
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <form action={formAction} className="space-y-5">
            <input type="hidden" name="mode" value={mode} />
            <input type="hidden" name="tone" value={tone} />
            <input type="hidden" name="lengthPreset" value={lengthPreset} />

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-white">Select platforms</h3>
                <p className="text-sm text-slate-400">Generate only the outputs you want.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {platformOptions.map(([platformKey, meta]) => {
                  const checked = selectedPlatforms.includes(platformKey);
                  const Icon = platformIcons[platformKey];

                  return (
                    <label
                      key={platformKey}
                      className={`group flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                        checked
                          ? "border-emerald-400/70 bg-emerald-400/10 text-white shadow-[0_0_0_1px_rgba(52,211,153,0.25),0_12px_35px_-18px_rgba(16,185,129,0.55)] ring-1 ring-emerald-400/35"
                          : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-400/30 hover:bg-white/10 hover:shadow-[0_12px_30px_-20px_rgba(15,23,42,0.65)]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="platforms"
                        value={platformKey}
                        checked={checked}
                        onChange={() => togglePlatform(platformKey)}
                        className="mt-1"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 font-medium">
                          <Icon className="h-4 w-4" />
                          {meta.label}
                        </div>
                        <p className={`text-sm ${checked ? "text-slate-200" : "text-slate-400"}`}>
                          {meta.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-white">Tone</h3>
                <p className="text-sm text-slate-400">
                  Free stays on Professional. Paid plans unlock the rest.
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
                      className={`rounded-xl border p-4 text-left transition ${
                        active
                          ? "border-emerald-400/20 bg-emerald-400/10 text-white"
                          : locked
                          ? "cursor-not-allowed border-white/10 bg-slate-950/60 text-slate-400"
                          : "border-white/10 bg-white/5 text-slate-100 hover:border-white/20 hover:bg-white/10"
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
                      <p className={`mt-2 text-sm ${active ? "text-slate-200" : locked ? "text-slate-400" : "text-slate-400"}`}>
                        {meta.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-white">Length</h3>
                <p className="text-sm text-slate-400">
                  Control how compact or expanded the output should feel.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {lengthOptions.map(([presetKey, meta]) => {
                  const active = lengthPreset === presetKey;

                  return (
                    <button
                      key={presetKey}
                      type="button"
                      onClick={() => setLengthPreset(presetKey)}
                      className={`rounded-xl border p-4 text-left transition ${
                        active
                          ? "border-emerald-400/20 bg-emerald-400/10 text-white"
                          : "border-white/10 bg-white/5 text-slate-100 hover:border-white/20 hover:bg-white/10"
                      }`}
                    >
                      <div className="font-medium">{meta.label}</div>
                      <p className={`mt-2 text-sm ${active ? "text-slate-200" : "text-slate-400"}`}>
                        {meta.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {mode === "link" ? (
              <div className="space-y-2">
                <label htmlFor="source-url" className="text-sm font-medium text-slate-300">
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
              </div>
            ) : mode === "youtube" ? (
              <div className="space-y-2">
                <label htmlFor="youtube-url" className="text-sm font-medium text-slate-300">
                  YouTube URL
                </label>
                <div className="relative">
                  <PlaySquare className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="youtube-url"
                    name="youtubeUrl"
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(event) => setYoutubeUrl(event.target.value)}
                    disabled={pending}
                    required={mode === "youtube"}
                    className="pl-9"
                  />
                </div>
                <p className="text-sm text-slate-400">
                  The app fetches the transcript first, then generates platform-specific content from it.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor="source-text" className="text-sm font-medium text-slate-300">
                    Source text
                  </label>
                  <span className={`text-sm ${wordCount > TEXT_LIMIT ? "text-red-600" : "text-slate-400"}`}>
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
                  rows={12}
                />
              </div>
            )}

            {state.error ? (
              <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {state.error}
              </div>
            ) : null}

            <Button type="submit" size="lg" disabled={pending || atLimit} className="h-12 px-6 text-base font-semibold">
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
                  Generate selected platforms
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {pending ? (
        <Card className="border border-white/10 bg-white/5 text-slate-50 shadow-soft backdrop-blur">
          <CardContent className="flex items-center gap-3 py-6 text-slate-300">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            Building your selected platform outputs...
          </CardContent>
        </Card>
      ) : null}

      {state.data ? (
        (() => {
          const result = state.data;

          return (
            <div className="space-y-4">
              <Card className="border border-white/10 bg-white/5 text-slate-50 shadow-soft backdrop-blur">
                <CardHeader className="gap-2">
                  <CardTitle className="text-white">Latest result</CardTitle>
                  <CardDescription className="text-slate-300">
                    {result.inputMode} • {TONE_META[result.tone].label} • {LENGTH_META[result.lengthPreset].label}
                  </CardDescription>
                  <div className="text-sm font-medium text-white">{result.sourceTitle}</div>
                  {result.sourceUrl ? (
                    <a
                      href={result.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="break-all text-sm font-medium text-slate-300 underline underline-offset-4"
                    >
                      {result.sourceUrl}
                    </a>
                  ) : null}
                </CardHeader>
              </Card>

              {result.selectedPlatforms.map((platform) => {
                const textValue = result.outputs[platform];
                if (!textValue) return null;

                const Icon = platformIcons[platform];

                return (
                  <Card key={platform} className="border border-white/10 bg-white/5 text-slate-50 shadow-soft backdrop-blur">
                    <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-white">
                          <Icon className="h-5 w-5" />
                          {PLATFORM_META[platform].label}
                        </CardTitle>
                        <CardDescription className="text-slate-300">{PLATFORM_META[platform].description}</CardDescription>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <CopyButton text={textValue} label="Copy" />
                        <ExportButton
                          text={textValue}
                          filename={`${platform}.txt`}
                          disabled={!imageUnlocked}
                        />
                        {platform !== "newsletter" ? (
                          <OpenInAppButton
                            platform={platform}
                            text={textValue}
                            sourceTitle={result.sourceTitle}
                            imageUrl={imageUrl}
                          />
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
                        {textValue}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              <Card className="border border-white/10 bg-white/5 text-slate-50 shadow-soft backdrop-blur">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-white">
                      <FileImage className="h-5 w-5" />
                      Matching image
                    </CardTitle>
                    <CardDescription className="text-slate-300">
                      Generate a matching visual directly inside Repurpo with your monthly image allowance.
                    </CardDescription>
                  </div>
                  <a
                    href={upgradeHref}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-medium text-white transition hover:bg-slate-950/60"
                  >
                    View plans
                  </a>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm text-slate-300">
                        Free gets 1 image per month, Plus gets 5 per month, and Pro gets unlimited images.
                      </div>
                      <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-4 text-sm text-amber-100">
                        Generated images are temporary and do not appear in history yet. Download them before leaving this page.
                      </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="image-prompt" className="text-sm font-medium text-slate-300">
                          Image prompt
                        </label>
                        <Textarea
                          id="image-prompt"
                          value={imagePrompt}
                          onChange={(event) => setImagePrompt(event.target.value)}
                          rows={5}
                          placeholder="Describe the image you want..."
                        />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="image-ratio" className="text-sm font-medium text-slate-300">
                          Aspect ratio
                        </label>
                        <select
                          id="image-ratio"
                          value={imageAspectRatio}
                          onChange={(event) =>
                            setImageAspectRatio(
                              event.target.value as "1:1" | "3:4" | "4:3" | "9:16" | "16:9"
                            )
                          }
                          className="flex h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-50 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                        >
                          <option value="1:1">1:1</option>
                          <option value="3:4">3:4</option>
                          <option value="4:3">4:3</option>
                          <option value="9:16">9:16</option>
                          <option value="16:9">16:9</option>
                        </select>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                        {imageUsage.imageMonthlyLimit === null
                          ? `Unlimited images on ${currentTier === "pro" ? "Pro" : "your plan"}.`
                          : `${imageUsage.imageUsedThisMonth}/${imageUsage.imageMonthlyLimit} images used in ${imageUsage.usageWindowLabel}. ${imageUsage.imageRemainingThisMonth} remaining.`}
                      </div>

                      {imageError ? (
                        <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                          {imageError}
                        </div>
                      ) : null}

                      <Button type="button" onClick={handleGenerateImage} disabled={imageLoading || imageAtLimit}>
                        {imageLoading ? (
                          <>
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                            Generating image...
                          </>
                        ) : (
                          <>
                            <FileImage className="h-4 w-4" />
                            Generate image
                          </>
                        )}
                      </Button>

                    {imageUrl ? (
                      <div className="space-y-3">
                        <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/60 p-3">
                          <Image
                            src={imageUrl}
                            alt="Generated visual"
                            width={1400}
                            height={1400}
                            unoptimized
                            className="h-auto w-full rounded-lg"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" variant="outline" onClick={handleDownloadImage}>
                            <Download className="h-4 w-4" />
                            Download image
                          </Button>
                        </div>
                      </div>
                    ) : null}
                </CardContent>
              </Card>
            </div>
          );
        })()
      ) : null}
    </div>
  );
}
