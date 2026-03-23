"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Crown,
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
  usageWindowLabel: string;
  upgradeHref: string;
};

const platformIcons: Record<ContentPlatform, React.ComponentType<{ className?: string }>> = {
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

  const usage = state.usage ?? {
    tier,
    usedThisMonth,
    monthlyLimit,
    remainingThisMonth,
    usageWindowLabel
  };

  const currentTier = usage.tier;
  const atLimit = usage.monthlyLimit !== null && usage.usedThisMonth >= usage.monthlyLimit;
  const imageUnlocked = isImageUnlocked(currentTier);

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
    if (!state.data) return;

    const seed =
      state.data.outputs.instagram ??
      state.data.outputs.linkedin ??
      state.data.outputs.x ??
      state.data.outputs.newsletter ??
      state.data.outputs.reddit ??
      "";

    const compactSeed = seed.replace(/\s+/g, " ").trim().slice(0, 260);

    setImagePrompt(
      `Create a clean modern social media visual inspired by "${state.data.sourceTitle}". Tone: ${state.data.tone}. Style: premium editorial, sharp composition, no watermarks, no visible UI. Context: ${compactSeed}`
    );
    setImageUrl(null);
    setImageError(null);
  }, [state.data]);

  async function handleGenerateImage() {
    if (!imageUnlocked) {
      setImageError("Image generation is available on Plus and Pro only.");
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
      };

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
              Link, text, or YouTube in. Multi-platform content out. Plus and Pro also unlock in-app image generation.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-0 bg-white shadow-soft">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Plan & usage</CardTitle>
              <CardDescription>Limits are enforced on the server.</CardDescription>
            </div>

            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
              {usage.monthlyLimit === null ? (
                <div className="flex items-center gap-2 font-medium">
                  <Crown className="h-4 w-4" />
                  {currentTier === "plus" ? "Plus" : "Pro"} plan • Unlimited generations
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
                    Upgrade to Plus or Pro to unlock all tones and image generation.
                  </p>
                </div>
                <a
                  href={upgradeHref}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Upgrade
                </a>
              </div>
            </div>
          ) : null}
        </CardHeader>
      </Card>

      <Card className="border-0 bg-white shadow-soft">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Input mode</CardTitle>
              <CardDescription>Article, pasted text, or YouTube transcript.</CardDescription>
            </div>

            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode("link")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  mode === "link"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Link
              </button>
              <button
                type="button"
                onClick={() => setMode("text")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  mode === "text"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Text
              </button>
              <button
                type="button"
                onClick={() => setMode("youtube")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  mode === "youtube"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
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
                <h3 className="text-sm font-medium text-slate-900">Select platforms</h3>
                <p className="text-sm text-slate-500">Generate only the outputs you want.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {platformOptions.map(([platformKey, meta]) => {
                  const checked = selectedPlatforms.includes(platformKey);
                  const Icon = platformIcons[platformKey];

                  return (
                    <label
                      key={platformKey}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                        checked
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
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
                        <p className={`text-sm ${checked ? "text-slate-200" : "text-slate-500"}`}>
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
                <h3 className="text-sm font-medium text-slate-900">Tone</h3>
                <p className="text-sm text-slate-500">
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
                      <p className={`mt-2 text-sm ${active ? "text-slate-200" : locked ? "text-slate-400" : "text-slate-500"}`}>
                        {meta.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-slate-900">Length</h3>
                <p className="text-sm text-slate-500">
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
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="font-medium">{meta.label}</div>
                      <p className={`mt-2 text-sm ${active ? "text-slate-200" : "text-slate-500"}`}>
                        {meta.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

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
              </div>
            ) : mode === "youtube" ? (
              <div className="space-y-2">
                <label htmlFor="youtube-url" className="text-sm font-medium text-slate-700">
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
                <p className="text-sm text-slate-500">
                  The app fetches the transcript first, then generates platform-specific content from it.
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
                  rows={12}
                />
              </div>
            )}

            {state.error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
        <Card className="border-0 bg-white shadow-soft">
          <CardContent className="flex items-center gap-3 py-6 text-slate-700">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            Building your selected platform outputs...
          </CardContent>
        </Card>
      ) : null}

      {state.data ? (
        <div className="space-y-4">
          <Card className="border-0 bg-white shadow-soft">
            <CardHeader className="gap-2">
              <CardTitle>Latest result</CardTitle>
              <CardDescription>
                {state.data.inputMode} • {TONE_META[state.data.tone].label} • {LENGTH_META[state.data.lengthPreset].label}
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

          {state.data.selectedPlatforms.map((platform) => {
            const textValue = state.data?.outputs[platform];
            if (!textValue) return null;

            const Icon = platformIcons[platform];

            return (
              <Card key={platform} className="border-0 bg-white shadow-soft">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Icon className="h-5 w-5" />
                      {PLATFORM_META[platform].label}
                    </CardTitle>
                    <CardDescription>{PLATFORM_META[platform].description}</CardDescription>
                  </div>
                  
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {textValue}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Card className="border-0 bg-white shadow-soft">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-1">
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
      sourceTitle={state.data?.sourceTitle}
      imageUrl={imageUrl}
    />
  ) : null}
</div>
                <CardTitle className="flex items-center gap-2">
                  <FileImage className="h-5 w-5" />
                  Matching image
                </CardTitle>
                <CardDescription>
                  Generate a matching visual directly inside Repurpo.
                </CardDescription>
              </div>
              {!imageUnlocked ? (
                <a
                  href={upgradeHref}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                >
                  Unlock on Plus
                </a>
              ) : null}
            </CardHeader>

            <CardContent className="space-y-4">
              {!imageUnlocked ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  Image generation is locked on Free. Upgrade to Plus or Pro to enable it.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label htmlFor="image-prompt" className="text-sm font-medium text-slate-700">
                      Image prompt
                    </label>
                    <Textarea
                      id="image-prompt"
                      value={imagePrompt}
                      onChange={(event) => setImagePrompt(event.target.value)}
                      rows={4}
                      placeholder="Describe the image you want..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="image-ratio" className="text-sm font-medium text-slate-700">
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
                      className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    >
                      <option value="1:1">1:1</option>
                      <option value="3:4">3:4</option>
                      <option value="4:3">4:3</option>
                      <option value="9:16">9:16</option>
                      <option value="16:9">16:9</option>
                    </select>
                  </div>

                  {imageError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {imageError}
                    </div>
                  ) : null}

                  <Button type="button" onClick={handleGenerateImage} disabled={imageLoading}>
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
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <img
                        src={imageUrl}
                        alt="Generated visual"
                        className="h-auto w-full rounded-lg"
                      />
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
