"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent } from "react";
import {
  Download,
  FileImage,
  FileText,
  Link2,
  LoaderCircle,
  Megaphone,
  MessageSquareQuote,
  Newspaper,
  PlaySquare,
  WandSparkles
} from "lucide-react";
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
import { type GenerationFormState } from "@/app/dashboard/actions";
import { type ViewerDraft } from "@/lib/viewer";

const TEXT_LIMIT = 5000;

const toneOptions = Object.entries(TONE_META) as Array<[ContentTone, (typeof TONE_META)[ContentTone]]>;
const lengthOptions = Object.entries(LENGTH_META) as Array<[LengthPreset, (typeof LENGTH_META)[LengthPreset]]>;
const platformOptions = Object.entries(PLATFORM_META) as Array<[ContentPlatform, (typeof PLATFORM_META)[ContentPlatform]]>;

const ALL_PLATFORM_KEYS: ContentPlatform[] = ["linkedin", "x", "instagram", "reddit", "newsletter"];

type PlatformStyle = {
  tone: ContentTone;
  lengthPreset: LengthPreset;
};

const DEFAULT_PLATFORM_STYLE: PlatformStyle = {
  tone: "professional",
  lengthPreset: "medium"
};

const INITIAL_PLATFORM_STYLES: Record<ContentPlatform, PlatformStyle> = {
  linkedin: DEFAULT_PLATFORM_STYLE,
  x: DEFAULT_PLATFORM_STYLE,
  instagram: DEFAULT_PLATFORM_STYLE,
  reddit: DEFAULT_PLATFORM_STYLE,
  newsletter: DEFAULT_PLATFORM_STYLE
};

const initialGenerationFormState: GenerationFormState = {
  success: false,
  error: null,
  errorCode: null,
  manualFallback: null,
  data: null,
  usage: null
};

type DashboardGeneratorProps = {
  initialDraft?: ViewerDraft | null;
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

function isContentTone(value: unknown): value is ContentTone {
  return value === "professional" || value === "casual" || value === "viral" || value === "authority";
}

function isLengthPreset(value: unknown): value is LengthPreset {
  return value === "short" || value === "medium" || value === "long";
}

function normalizeSelectedPreferences(
  current: Record<ContentPlatform, PlatformStyle>,
  selected: ContentPlatform[]
) {
  return selected.reduce<Record<ContentPlatform, PlatformStyle>>((acc, platform) => {
    acc[platform] = current[platform] ?? DEFAULT_PLATFORM_STYLE;
    return acc;
  }, {} as Record<ContentPlatform, PlatformStyle>);
}

export function DashboardGenerator({
  initialDraft,
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
  const [selectedPlatforms, setSelectedPlatforms] = useState<ContentPlatform[]>(["linkedin", "x", "newsletter"]);
  const [platformPreferences, setPlatformPreferences] = useState<Record<ContentPlatform, PlatformStyle>>(INITIAL_PLATFORM_STYLES);

  const [url, setUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [text, setText] = useState("");
  const [manualText, setManualText] = useState("");

  const [imagePrompt, setImagePrompt] = useState("");
  const [imageAspectRatio, setImageAspectRatio] = useState<"1:1" | "3:4" | "4:3" | "9:16" | "16:9">("1:1");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  const [state, setState] = useState<GenerationFormState>(initialGenerationFormState);
  const [pending, setPending] = useState(false);
  const [imageUsage, setImageUsage] = useState({
    imageUsedThisMonth,
    imageMonthlyLimit,
    imageRemainingThisMonth,
    usageWindowLabel
  });
  const [draftReady, setDraftReady] = useState(false);
  const [applyFlash, setApplyFlash] = useState<"idle" | "applied" | "none">("idle");
  const appliedInitialDraft = useRef(false);
  const lastAutosavePayloadRef = useRef<string>("");

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
  const imageAtLimit = imageUsage.imageMonthlyLimit !== null && imageUsage.imageUsedThisMonth >= imageUsage.imageMonthlyLimit;

  const wordCount = useMemo(() => {
    const value = text.trim();
    return value ? value.split(/\s+/).length : 0;
  }, [text]);

  function togglePlatform(platform: ContentPlatform) {
    setSelectedPlatforms((current) =>
      current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform]
    );
    setPlatformPreferences((current) => ({
      ...current,
      [platform]: current[platform] ?? DEFAULT_PLATFORM_STYLE
    }));
  }

  function updatePlatformStyle(platform: ContentPlatform, patch: Partial<PlatformStyle>) {
    setPlatformPreferences((current) => ({
      ...current,
      [platform]: {
        ...(current[platform] ?? DEFAULT_PLATFORM_STYLE),
        ...patch
      }
    }));
  }

  function applyDefaultStyleToSelectedPlatforms() {
    if (selectedPlatforms.length === 0) {
      setApplyFlash("none");
      setTimeout(() => setApplyFlash("idle"), 2000);
      return;
    }
    setPlatformPreferences((current) => {
      const next = { ...current };
      for (const platform of selectedPlatforms) {
        next[platform] = { tone, lengthPreset };
      }
      return next;
    });
    setApplyFlash("applied");
    setTimeout(() => setApplyFlash("idle"), 2000);
  }

  useEffect(() => {
    if (appliedInitialDraft.current) return;
    appliedInitialDraft.current = true;

    if (!initialDraft) {
      setDraftReady(true);
      return;
    }

    const settings = initialDraft.settingsJson ?? {};
    const draftMode = initialDraft.inputType;

    if (draftMode === "link" || draftMode === "text" || draftMode === "youtube") {
      setMode(draftMode);
    }

    if (draftMode === "link") setUrl(initialDraft.rawContent);
    else if (draftMode === "youtube") setYoutubeUrl(initialDraft.rawContent);
    else setText(initialDraft.rawContent);

    if (settings.mode === "link" || settings.mode === "text" || settings.mode === "youtube") {
      setMode(settings.mode);
    }

    if (isContentTone(settings.tone)) setTone(settings.tone);
    if (isLengthPreset(settings.lengthPreset)) setLengthPreset(settings.lengthPreset);

    const settingsPlatforms = settings.selectedPlatforms;
    if (Array.isArray(settingsPlatforms) && settingsPlatforms.length > 0) {
      const normalized = settingsPlatforms.filter((item): item is ContentPlatform => ALL_PLATFORM_KEYS.includes(item as ContentPlatform));
      setSelectedPlatforms(normalized);
    }

    const settingsPlatformPreferences = settings.platformPreferences;
    if (settingsPlatformPreferences && typeof settingsPlatformPreferences === "object") {
      setPlatformPreferences((current) => {
        const next = { ...current };
        for (const platform of ALL_PLATFORM_KEYS) {
          const candidate = (settingsPlatformPreferences as Record<string, unknown>)[platform];
          if (!candidate || typeof candidate !== "object") continue;
          const candidateTone = (candidate as { tone?: unknown }).tone;
          const candidateLength = (candidate as { lengthPreset?: unknown }).lengthPreset;
          if (isContentTone(candidateTone) && isLengthPreset(candidateLength)) {
            next[platform] = { tone: candidateTone, lengthPreset: candidateLength };
          }
        }
        return next;
      });
    }

    if (typeof settings.url === "string") setUrl(settings.url);
    if (typeof settings.youtubeUrl === "string") setYoutubeUrl(settings.youtubeUrl);
    if (typeof settings.text === "string") setText(settings.text);
    if (typeof settings.manualText === "string") setManualText(settings.manualText);
    if (typeof settings.imagePrompt === "string") setImagePrompt(settings.imagePrompt);
    if (settings.imageAspectRatio === "1:1" || settings.imageAspectRatio === "3:4" || settings.imageAspectRatio === "4:3" || settings.imageAspectRatio === "9:16" || settings.imageAspectRatio === "16:9") {
      setImageAspectRatio(settings.imageAspectRatio);
    }

    setDraftReady(true);
  }, [initialDraft]);

  useEffect(() => {
    if (typeof window === "undefined" || !draftReady) return;

    const payload = JSON.stringify({
      inputType: mode,
      rawContent: mode === "link" ? url : mode === "youtube" ? youtubeUrl : text,
      settingsJson: {
        mode,
        tone,
        lengthPreset,
        selectedPlatforms,
        platformPreferences,
        url,
        youtubeUrl,
        text,
        manualText,
        imagePrompt,
        imageAspectRatio
      }
    });

    if (payload === lastAutosavePayloadRef.current) return;

    const timer = window.setTimeout(() => {
      if (payload === lastAutosavePayloadRef.current) return;
      fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload
      })
        .then((response) => {
          if (response.ok) {
            lastAutosavePayloadRef.current = payload;
          }
        })
        .catch(() => {});
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [draftReady, imageAspectRatio, imagePrompt, lengthPreset, manualText, mode, platformPreferences, selectedPlatforms, text, tone, url, youtubeUrl]);

  async function submitGeneration(forceGenerate = false) {
    setPending(true);
    setImageError(null);
    setState(initialGenerationFormState);

    const currentUsage = usage;

    try {
      const response = await fetch("/api/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          tone,
          lengthPreset,
          platforms: selectedPlatforms,
          platformPreferences: normalizeSelectedPreferences(platformPreferences, selectedPlatforms),
          forceGenerate,
          url,
          youtubeUrl,
          text,
          manualText
        })
      });

      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok) {
        if (contentType.includes("application/json")) {
          const payload = (await response.json()) as Partial<GenerationFormState> & {
            error?: string;
            errorCode?: GenerationFormState["errorCode"];
            manualFallback?: GenerationFormState["manualFallback"];
          };

          setState({
            success: false,
            error: payload.error ?? "Generation failed.",
            errorCode: payload.errorCode ?? null,
            manualFallback: payload.manualFallback ?? null,
            data: null,
            usage: payload.usage ?? null
          });
          return;
        }

        const responseText = await response.text().catch(() => "");
        setState({
          success: false,
          error: responseText.trim() || `Generation failed with status ${response.status}.`,
          errorCode: null,
          manualFallback: null,
          data: null,
          usage: null
        });
        return;
      }

      if (!response.body) {
        setState({
          success: false,
          error: "No response stream.",
          errorCode: null,
          manualFallback: null,
          data: null,
          usage: null
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const patchOutput = (platform: ContentPlatform, value: string, replace = false) => {
        setState((current) => {
          if (!current.data) return current;
          const previous = current.data.outputs[platform] ?? "";
          return {
            ...current,
            data: {
              ...current.data,
              outputs: {
                ...current.data.outputs,
                [platform]: replace ? value : `${previous}${value}`
              }
            }
          };
        });
      };

      // True once a terminal SSE event (complete or error) has been processed.
      // Prevents the post-loop fallback setState from overwriting the real outcome.
      let streamTerminated = false;

      const handleEvent = (event: string, payload: Record<string, unknown>) => {
        if (event === "start") {
          setState({
            success: false,
            error: null,
            errorCode: null,
            manualFallback: null,
            data: {
              inputMode: (payload.inputMode as "link" | "text" | "youtube") ?? mode,
              tone,
              lengthPreset,
              sourceTitle: String(payload.sourceTitle ?? ""),
              sourceUrl: typeof payload.sourceUrl === "string" ? payload.sourceUrl : null,
              outputs: {},
              imagePrompt: "",
              selectedPlatforms: Array.isArray(payload.selectedPlatforms) ? (payload.selectedPlatforms as ContentPlatform[]) : selectedPlatforms,
              platformPreferences: normalizeSelectedPreferences(platformPreferences, selectedPlatforms)
            },
            usage: currentUsage
          });
          return;
        }

        if (event === "platform_chunk") {
          const platform = payload.platform as ContentPlatform;
          const chunk = String(payload.chunk ?? "");
          if (platform) patchOutput(platform, chunk, false);
          return;
        }

        if (event === "platform_done") {
          const platform = payload.platform as ContentPlatform;
          const finalText = String(payload.text ?? "");
          if (platform) patchOutput(platform, finalText, true);
          return;
        }

        if (event === "complete") {
          const outputs = (payload.outputs as Partial<Record<ContentPlatform, string>>) ?? {};
          const usagePayload = payload.usage as GenerationFormState["usage"] | undefined;
          const completeImagePrompt = String(payload.imagePrompt ?? "");

          setState({
            success: true,
            error: null,
            errorCode: null,
            manualFallback: null,
            data: {
              inputMode: (payload.inputMode as "link" | "text" | "youtube") ?? mode,
              tone,
              lengthPreset,
              sourceTitle: String(payload.sourceTitle ?? ""),
              sourceUrl: typeof payload.sourceUrl === "string" ? payload.sourceUrl : null,
              outputs,
              imagePrompt: completeImagePrompt,
              selectedPlatforms,
              platformPreferences: normalizeSelectedPreferences(platformPreferences, selectedPlatforms)
            },
            usage: usagePayload ?? currentUsage
          });
          streamTerminated = true;
          setImagePrompt(completeImagePrompt);
          if (usagePayload) {
            setImageUsage({
              imageUsedThisMonth: usagePayload.imageUsedThisMonth,
              imageMonthlyLimit: usagePayload.imageMonthlyLimit,
              imageRemainingThisMonth: usagePayload.imageRemainingThisMonth,
              usageWindowLabel: usagePayload.usageWindowLabel
            });
          }
          return;
        }

        if (event === "error") {
          streamTerminated = true;
          setState({
            success: false,
            error: String(payload.error ?? "Generation failed."),
            errorCode: null,
            manualFallback: null,
            data: null,
            usage: currentUsage
          });
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let splitIndex = buffer.indexOf("\n\n");
        while (splitIndex !== -1) {
          const block = buffer.slice(0, splitIndex).trim();
          buffer = buffer.slice(splitIndex + 2);
          if (block) {
            const lines = block.split("\n");
            const eventLine = lines.find((line) => line.startsWith("event:"));
            const dataLine = lines.find((line) => line.startsWith("data:"));
            const event = eventLine?.slice(6).trim();
            const raw = dataLine?.slice(5).trim();
            if (event && raw) {
              try {
                handleEvent(event, JSON.parse(raw) as Record<string, unknown>);
              } catch {
                // ignore malformed stream chunks
              }
            }
          }
          splitIndex = buffer.indexOf("\n\n");
        }
      }
      // Only fire the fallback error if the stream closed without a terminal
      // event (complete or error). Without this guard, a proper error from the
      // server would be immediately overwritten by "Generation failed.".
      if (!streamTerminated) {
        setState({
          success: false,
          error: "Generation failed.",
          errorCode: null,
          manualFallback: null,
          data: null,
          usage: currentUsage
        });
      }
    } finally {
      setPending(false);
    }
  }

  function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitGeneration(false);
  }

  function handleRegenerate() {
    void submitGeneration(true);
  }

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
      setImageError(currentTier === "free" ? "You already used your 1 image for this month on Free." : "You reached your monthly image limit for Plus.");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imagePrompt, aspectRatio: imageAspectRatio })
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

      if (result.usage) setImageUsage(result.usage);
      if (!response.ok) throw new Error(result.error || "Image generation failed.");
      if (!result.imageDataUrl) throw new Error("No image was returned.");
      setImageUrl(result.imageDataUrl);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Image generation failed.");
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
              {(["link", "text", "youtube"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMode(item)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    mode === item ? "bg-slate-50 text-slate-950 shadow-md shadow-black/20" : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item === "link" ? "Link" : item === "text" ? "Text" : "YouTube"}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <form onSubmit={handleGenerate} className="space-y-5">
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
                          ? "border-emerald-400/70 bg-emerald-400/10 text-white"
                          : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-400/30 hover:bg-white/10"
                      }`}
                    >
                      <input type="checkbox" name="platforms" value={platformKey} checked={checked} onChange={() => togglePlatform(platformKey)} className="mt-1" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 font-medium">
                          <Icon className="h-4 w-4" />
                          {meta.label}
                        </div>
                        <p className={`text-sm ${checked ? "text-slate-200" : "text-slate-400"}`}>{meta.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-white">Default style</h3>
                <p className="text-sm text-slate-400">Used when you apply defaults to selected platforms.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Tone</label>
                  <select
                    value={tone}
                    onChange={(event) => setTone(event.target.value as ContentTone)}
                    disabled={pending}
                    className="flex h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-50 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {toneOptions.map(([toneKey, meta]) => (
                      <option key={toneKey} value={toneKey} disabled={meta.proOnly && currentTier === "free"}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Length</label>
                  <select
                    value={lengthPreset}
                    onChange={(event) => setLengthPreset(event.target.value as LengthPreset)}
                    disabled={pending}
                    className="flex h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-50 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {lengthOptions.map(([lengthKey, meta]) => (
                      <option key={lengthKey} value={lengthKey}>{meta.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-white">Platform style</h3>
                  <p className="text-xs text-slate-400">Set tone and length separately for each selected platform.</p>
                </div>
                <div className="flex items-center gap-3">
                  {applyFlash === "applied" && (
                    <span className="text-xs font-medium text-emerald-400">✓ Applied to all platforms</span>
                  )}
                  {applyFlash === "none" && (
                    <span className="text-xs font-medium text-amber-400">Select platforms first</span>
                  )}
                  <Button type="button" variant="outline" onClick={applyDefaultStyleToSelectedPlatforms} disabled={pending}>
                    Apply defaults
                  </Button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {selectedPlatforms.map((platform) => {
                  const prefs = platformPreferences[platform] ?? DEFAULT_PLATFORM_STYLE;
                  const meta = PLATFORM_META[platform];
                  return (
                    <div key={platform} className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-3 md:grid-cols-[1.2fr_1fr_1fr] md:items-center">
                      <div>
                        <div className="text-sm font-medium text-white">{meta.label}</div>
                        <div className="text-xs text-slate-400">{meta.description}</div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-400">Tone</label>
                        <select
                          value={prefs.tone}
                          onChange={(event) => updatePlatformStyle(platform, { tone: event.target.value as ContentTone })}
                          disabled={pending}
                          className="flex h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-50 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                        >
                          {toneOptions.map(([toneKey, toneMeta]) => (
                            <option key={toneKey} value={toneKey} disabled={toneMeta.proOnly && currentTier === "free"}>{toneMeta.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-400">Length</label>
                        <select
                          value={prefs.lengthPreset}
                          onChange={(event) => updatePlatformStyle(platform, { lengthPreset: event.target.value as LengthPreset })}
                          disabled={pending}
                          className="flex h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-50 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                        >
                          {lengthOptions.map(([lengthKey, lengthMeta]) => (
                            <option key={lengthKey} value={lengthKey}>{lengthMeta.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {mode === "link" ? (
              <div className="space-y-2">
                <label htmlFor="source-url" className="text-sm font-medium text-slate-300">Article URL</label>
                <Input id="source-url" name="url" type="url" placeholder="https://example.com/article" value={url} onChange={(event) => setUrl(event.target.value)} disabled={pending} required={mode === "link"} />
              </div>
            ) : mode === "youtube" ? (
              <div className="space-y-2">
                <label htmlFor="youtube-url" className="text-sm font-medium text-slate-300">YouTube URL</label>
                <div className="relative">
                  <PlaySquare className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input id="youtube-url" name="youtubeUrl" type="url" placeholder="https://www.youtube.com/watch?v=..." value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} disabled={pending} required={mode === "youtube"} className="pl-9" />
                </div>
                <p className="text-sm text-slate-400">The app fetches the transcript first, then generates platform-specific content from it.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor="source-text" className="text-sm font-medium text-slate-300">Source text</label>
                  <span className={`text-sm ${wordCount > TEXT_LIMIT ? "text-red-600" : "text-slate-400"}`}>{wordCount}/{TEXT_LIMIT} words</span>
                </div>
                <Textarea id="source-text" name="text" placeholder="Paste your source text here..." value={text} onChange={(event) => setText(event.target.value)} disabled={pending} required={mode === "text"} rows={12} />
              </div>
            )}

            {state.error ? <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{state.error}</div> : null}

            {state.errorCode === "EXTRACTION_FAILED" && mode !== "text" ? (
              <div className="space-y-2">
                <label htmlFor="manual-text" className="text-sm font-medium text-slate-300">Manual Input</label>
                <Textarea id="manual-text" name="manualText" placeholder="Paste the article text or transcript here, then try again." value={manualText} onChange={(event) => setManualText(event.target.value)} disabled={pending} rows={10} />
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
        <div className="space-y-4">
          <Card className="border border-white/10 bg-white/5 text-slate-50 shadow-soft backdrop-blur">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <CardTitle className="text-white">Latest result</CardTitle>
                <CardDescription className="text-slate-300">{state.data.inputMode} • Platform-specific settings</CardDescription>
                <div className="text-sm font-medium text-white">{state.data.sourceTitle}</div>
                {state.data.sourceUrl ? (
                  <a href={state.data.sourceUrl} target="_blank" rel="noreferrer noopener" className="break-all text-sm font-medium text-slate-300 underline underline-offset-4">
                    {state.data.sourceUrl}
                  </a>
                ) : null}
              </div>
              <Button type="button" variant="outline" onClick={handleRegenerate} disabled={pending}>
                <WandSparkles className="h-4 w-4" />
                Regenerate without cache
              </Button>
            </CardHeader>
          </Card>

          {(() => {
            const data = state.data;
            if (!data) return null;
            return data.selectedPlatforms.map((platform) => {
              const textValue = data.outputs[platform];
              if (!textValue) return null;
              const prefs = data.platformPreferences?.[platform] ?? DEFAULT_PLATFORM_STYLE;
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
                      <CardDescription className="text-slate-400">{TONE_META[prefs.tone].label} • {LENGTH_META[prefs.lengthPreset].label}</CardDescription>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <CopyButton text={textValue} label="Copy" />
                      <ExportButton text={textValue} filename={`${platform}.txt`} disabled={!imageUnlocked} />
                      {platform !== "newsletter" && platform !== "instagram" ? (
                        <OpenInAppButton platform={platform} text={textValue} sourceTitle={data.sourceTitle} imageUrl={imageUrl} />
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{textValue}</div>
                  </CardContent>
                </Card>
              );
            });
          })()}

          <Card className="border border-white/10 bg-white/5 text-slate-50 shadow-soft backdrop-blur">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-white">
                  <FileImage className="h-5 w-5" />
                  Matching image
                </CardTitle>
                <CardDescription className="text-slate-300">Generate a matching visual directly inside Repurpo with your monthly image allowance.</CardDescription>
              </div>
              <a href={upgradeHref} className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-medium text-white transition hover:bg-slate-950/60">
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
                <label htmlFor="image-prompt" className="text-sm font-medium text-slate-300">Image prompt</label>
                <Textarea id="image-prompt" value={imagePrompt} onChange={(event) => setImagePrompt(event.target.value)} rows={5} placeholder="Describe the image you want..." />
              </div>

              <div className="space-y-2">
                <label htmlFor="image-ratio" className="text-sm font-medium text-slate-300">Aspect ratio</label>
                <select id="image-ratio" value={imageAspectRatio} onChange={(event) => setImageAspectRatio(event.target.value as "1:1" | "3:4" | "4:3" | "9:16" | "16:9")} className="flex h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-50 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20">
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

              {imageError ? <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{imageError}</div> : null}

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
                    <Image src={imageUrl} alt="Generated visual" width={1400} height={1400} unoptimized className="h-auto w-full rounded-lg" />
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
      ) : null}
    </div>
  );
}
