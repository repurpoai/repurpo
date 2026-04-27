import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewerContext } from "@/lib/viewer";
import { extractArticleFromUrl } from "@/lib/extract-article";
import { extractYouTubeTranscript } from "@/lib/youtube";
import { generateRepurposedContent } from "@/lib/gemini";
import { makeGenerationSourceFingerprint, makePlatformGenerationCacheKey, readPlatformGenerationCache, storePlatformGenerationCache } from "@/lib/content-cache";
import {
  canUseTone,
  CONTENT_PLATFORMS,
  LENGTH_PRESETS,
  TONES,
  type ContentPlatform,
  type ContentTone,
  type LengthPreset
} from "@/lib/plans";
import { countWords, sanitizeSourceText } from "@/lib/utils";
import { logActivity } from "@/lib/activity";
import { acquireGenerationSlot, recordGenerationAttempt, releaseGenerationSlot } from "@/lib/generation-control";

type PlatformPreference = {
  tone: ContentTone;
  lengthPreset: LengthPreset;
};

type Body = {
  mode?: "link" | "text" | "youtube";
  tone?: ContentTone;
  lengthPreset?: LengthPreset;
  platforms?: ContentPlatform[];
  platformPreferences?: Partial<Record<ContentPlatform, Partial<PlatformPreference>>>;
  forceGenerate?: boolean;
  url?: string;
  youtubeUrl?: string;
  text?: string;
  manualText?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function splitForTyping(text: string, wordsPerChunk = 10) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= wordsPerChunk) return [text];
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(" ") + (i + wordsPerChunk < words.length ? " " : ""));
  }
  return chunks;
}

function getRequestIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstForwarded = forwardedFor?.split(",")[0]?.trim();
  return firstForwarded ?? request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip") ?? null;
}

function isAllowedTone(value: unknown): value is ContentTone {
  return value === "professional" || value === "casual" || value === "viral" || value === "authority";
}

function isAllowedLengthPreset(value: unknown): value is LengthPreset {
  return value === "short" || value === "medium" || value === "long";
}

function normalizePlatformPreferences(
  selectedPlatforms: ContentPlatform[],
  bodyPreferences: Body["platformPreferences"],
  fallbackTone: ContentTone,
  fallbackLength: LengthPreset
) {
  const normalized = {} as Record<ContentPlatform, PlatformPreference>;

  for (const platform of selectedPlatforms) {
    const candidate = bodyPreferences?.[platform] ?? {};
    normalized[platform] = {
      tone: isAllowedTone(candidate.tone) ? candidate.tone : fallbackTone,
      lengthPreset: isAllowedLengthPreset(candidate.lengthPreset) ? candidate.lengthPreset : fallbackLength
    };
  }

  return normalized;
}

export async function POST(request: NextRequest) {
  const viewer = await getViewerContext();
  if (!viewer) {
    return Response.json({ error: "Your session expired. Log in again." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const mode = body.mode === "youtube" ? "youtube" : body.mode === "link" ? "link" : "text";
  const globalTone = body.tone && TONES.includes(body.tone) ? body.tone : "professional";
  const globalLengthPreset = body.lengthPreset && LENGTH_PRESETS.includes(body.lengthPreset) ? body.lengthPreset : "medium";
  const selectedPlatforms = Array.isArray(body.platforms)
    ? body.platforms.filter((platform): platform is ContentPlatform => CONTENT_PLATFORMS.includes(platform))
    : [];
  const forceGenerate = Boolean(body.forceGenerate);

  if (!selectedPlatforms.length) {
    return Response.json({ error: "Select at least one platform." }, { status: 400 });
  }

  const platformPreferences = normalizePlatformPreferences(selectedPlatforms, body.platformPreferences, globalTone, globalLengthPreset);
  const requestedTones = Object.values(platformPreferences).map((item) => item.tone);
  if (requestedTones.some((tone) => !canUseTone(viewer.tier, tone))) {
    return Response.json({ error: "That tone is available on paid plans only." }, { status: 403 });
  }

  let sourceTitle = "";
  let sourceUrl: string | null = null;
  let sourceText = "";
  let sourceMeta: Record<string, unknown> = {};

  const manualText = sanitizeSourceText(String(body.manualText ?? ""));

  if (manualText.trim()) {
    sourceTitle = "Manual input";
    sourceText = manualText;
    sourceMeta = { kind: "manual" };
  } else if (mode === "link") {
    const url = String(body.url ?? "").trim();
    if (!url) {
      return Response.json({ error: "Enter a URL first." }, { status: 400 });
    }

    try {
      const article = await extractArticleFromUrl(url);
      sourceTitle = article.title;
      sourceUrl = article.url;
      sourceText = article.text;
      sourceMeta = { kind: "article" };
    } catch (error) {
      return Response.json(
        {
          errorCode: "EXTRACTION_FAILED",
          error: error instanceof Error ? error.message : "Could not extract readable content from that URL.",
          manualFallback: { inputMode: "link", sourceUrl: url }
        },
        { status: 422 }
      );
    }
  } else if (mode === "youtube") {
    const url = String(body.youtubeUrl ?? "").trim();
    if (!url) {
      return Response.json({ error: "Enter a valid YouTube URL." }, { status: 400 });
    }

    try {
      const video = await extractYouTubeTranscript(url);
      sourceTitle = video.title;
      sourceUrl = video.url;
      sourceText = video.text;
      sourceMeta = video.sourceMeta;
    } catch (error) {
      return Response.json(
        {
          errorCode: "EXTRACTION_FAILED",
          error: error instanceof Error ? error.message : "Could not fetch a usable YouTube transcript.",
          manualFallback: { inputMode: "youtube", sourceUrl: url }
        },
        { status: 422 }
      );
    }
  } else {
    const text = sanitizeSourceText(String(body.text ?? ""));
    if (countWords(text) < 400) {
      return Response.json({ error: "Paste more source text." }, { status: 400 });
    }

    sourceTitle = "Manual text input";
    sourceText = text;
    sourceMeta = { kind: "manual" };
  }

  const sourceFingerprint = makeGenerationSourceFingerprint({
    sourceUrl,
    sourceText,
    sourceKind: String(sourceMeta.kind ?? mode)
  });

  const cacheEntries = await Promise.all(
    selectedPlatforms.map(async (platform) => {
      const prefs = platformPreferences[platform];
      const cacheKey = makePlatformGenerationCacheKey({
        sourceFingerprint,
        platform,
        tone: prefs.tone,
        lengthPreset: prefs.lengthPreset
      });

      const cached = forceGenerate ? null : await readPlatformGenerationCache(cacheKey);
      return { platform, prefs, cacheKey, cached };
    })
  );

  const allCached = cacheEntries.every((entry) => entry.cached);

  if (allCached && !forceGenerate) {
    const cachedImagePrompt = cacheEntries[0]?.cached?.imagePrompt ?? "";
    const outputs = Object.fromEntries(cacheEntries.map((entry) => [entry.platform, entry.cached?.output ?? ""])) as Record<ContentPlatform, string>;

    const supabase = await createClient();
    const { error: insertError } = await supabase.from("generations").insert({
      user_id: viewer.userId,
      input_mode: mode,
      tone: cacheEntries[0]?.prefs.tone ?? globalTone,
      length_preset: cacheEntries[0]?.prefs.lengthPreset ?? globalLengthPreset,
      source_url: sourceUrl,
      source_title: sourceTitle,
      source_text: sourceText,
      source_meta: {
        ...sourceMeta,
        platformPreferences
      },
      selected_platforms: selectedPlatforms,
      outputs,
      linkedin_post: outputs.linkedin ?? "",
      twitter_thread: outputs.x ?? "",
      newsletter: outputs.newsletter ?? "",
      model_name: "cache"
    });

    await logActivity({
      actorUserId: viewer.userId,
      action: "generation_success",
      metadata: { mode, tone: "cache", lengthPreset: "cache", selectedPlatforms, sourceKind: sourceMeta.kind ?? null, cached: true }
    });

    const usedThisMonth = insertError ? viewer.usedThisMonth : viewer.usedThisMonth + 1;
    const remainingThisMonth = viewer.monthlyLimit === null ? null : Math.max(viewer.monthlyLimit - usedThisMonth, 0);

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(sse(event, data)));

        send("start", {
          inputMode: mode,
          tone: cacheEntries[0]?.prefs.tone ?? globalTone,
          lengthPreset: cacheEntries[0]?.prefs.lengthPreset ?? globalLengthPreset,
          sourceTitle,
          sourceUrl,
          selectedPlatforms
        });

        for (const entry of cacheEntries) {
          send("platform_start", { platform: entry.platform });
          send("platform_done", { platform: entry.platform, text: entry.cached?.output ?? "" });
        }

        send("complete", {
          inputMode: mode,
          tone: cacheEntries[0]?.prefs.tone ?? globalTone,
          lengthPreset: cacheEntries[0]?.prefs.lengthPreset ?? globalLengthPreset,
          sourceTitle,
          sourceUrl,
          outputs,
          imagePrompt: cachedImagePrompt,
          selectedPlatforms,
          platformPreferences,
          usage: {
            tier: viewer.tier,
            usedThisMonth,
            monthlyLimit: viewer.monthlyLimit,
            remainingThisMonth,
            imageUsedThisMonth: viewer.imageUsedThisMonth,
            imageMonthlyLimit: viewer.imageMonthlyLimit,
            imageRemainingThisMonth: viewer.imageRemainingThisMonth,
            usageWindowLabel: viewer.usageWindowLabel
          }
        });

        if (insertError) {
          console.warn("Generated from cache, but saving to history failed:", insertError);
        }

        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
  }

  if (viewer.monthlyLimit !== null && viewer.usedThisMonth >= viewer.monthlyLimit) {
    return Response.json(
      { error: "You have reached your monthly Free plan limit. Upgrade to continue generating." },
      { status: 429 }
    );
  }

  const requestIp = getRequestIp(request);
  const rateLimit = await recordGenerationAttempt(viewer.userId, requestIp);
  if (!rateLimit.allowed) {
    return Response.json(
      {
        error: "You are generating too quickly. Please wait before trying again.",
        retryAfterSeconds: rateLimit.retryAfterSeconds
      },
      {
        status: 429,
        headers: rateLimit.retryAfterSeconds ? { "Retry-After": String(rateLimit.retryAfterSeconds) } : undefined
      }
    );
  }

  const queueOwnerKey = randomUUID();
  let slotLease: Awaited<ReturnType<typeof acquireGenerationSlot>> = null;
  try {
    slotLease = await acquireGenerationSlot(queueOwnerKey, viewer.userId);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "The content engine is unavailable right now. Please try again."
      },
      { status: 503 }
    );
  }

  if (!slotLease) {
    return Response.json({ error: "The content engine is busy right now. Please try again in a moment." }, { status: 429 });
  }

  const releaseLease = "skipped" in slotLease ? null : slotLease;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(sse(event, data)));

      try {
        send("start", {
          inputMode: mode,
          tone: cacheEntries[0]?.prefs.tone ?? globalTone,
          lengthPreset: cacheEntries[0]?.prefs.lengthPreset ?? globalLengthPreset,
          sourceTitle,
          sourceUrl,
          selectedPlatforms
        });

        const missingPlatforms = cacheEntries.filter((entry) => !entry.cached).map((entry) => entry.platform);
        const generated = missingPlatforms.length
          ? await generateRepurposedContent({
              sourceTitle,
              sourceText,
              tone: globalTone,
              lengthPreset: globalLengthPreset,
              platformPreferences,
              platforms: missingPlatforms
            })
          : { outputs: {}, imagePrompt: "", modelName: "cache" };

        const outputs = Object.fromEntries(
          cacheEntries.map((entry) => [entry.platform, entry.cached?.output ?? generated.outputs[entry.platform] ?? ""])
        ) as Record<ContentPlatform, string>;

        const imagePrompt = generated.imagePrompt || cacheEntries.find((entry) => entry.cached?.imagePrompt)?.cached?.imagePrompt || "";

        for (const entry of cacheEntries) {
          send("platform_start", { platform: entry.platform });
          const text = outputs[entry.platform] ?? "";
          if (entry.cached) {
            send("platform_done", { platform: entry.platform, text });
          } else {
            let built = "";
            for (const chunk of splitForTyping(text, 10)) {
              built += chunk;
              send("platform_chunk", { platform: entry.platform, chunk });
              await sleep(8);
            }
            send("platform_done", { platform: entry.platform, text: built });
          }
        }

        await Promise.all(
          cacheEntries.map((entry) =>
            storePlatformGenerationCache({
              cacheKey: entry.cacheKey,
              sourceFingerprint,
              platform: entry.platform,
              tone: entry.prefs.tone,
              lengthPreset: entry.prefs.lengthPreset,
              output: outputs[entry.platform] ?? "",
              imagePrompt,
              sourceTitle,
              sourceUrl
            })
          )
        );

        const supabase = await createClient();
        const { error: insertError } = await supabase.from("generations").insert({
          user_id: viewer.userId,
          input_mode: mode,
          tone: cacheEntries[0]?.prefs.tone ?? globalTone,
          length_preset: cacheEntries[0]?.prefs.lengthPreset ?? globalLengthPreset,
          source_url: sourceUrl,
          source_title: sourceTitle,
          source_text: sourceText,
          source_meta: {
            ...sourceMeta,
            platformPreferences
          },
          selected_platforms: selectedPlatforms,
          outputs,
          linkedin_post: outputs.linkedin ?? "",
          twitter_thread: outputs.x ?? "",
          newsletter: outputs.newsletter ?? "",
          model_name: generated.modelName
        });

        revalidatePath("/history");
        revalidatePath("/dashboard");
        revalidatePath("/profile");

        await logActivity({
          actorUserId: viewer.userId,
          action: "generation_success",
          metadata: { mode, tone: "mixed", lengthPreset: "mixed", selectedPlatforms, sourceKind: sourceMeta.kind ?? null, cachedPlatforms: cacheEntries.filter((entry) => entry.cached).map((entry) => entry.platform) }
        });

        const usedThisMonth = insertError ? viewer.usedThisMonth : viewer.usedThisMonth + 1;
        const remainingThisMonth = viewer.monthlyLimit === null ? null : Math.max(viewer.monthlyLimit - usedThisMonth, 0);

        send("complete", {
          inputMode: mode,
          tone: cacheEntries[0]?.prefs.tone ?? globalTone,
          lengthPreset: cacheEntries[0]?.prefs.lengthPreset ?? globalLengthPreset,
          sourceTitle,
          sourceUrl,
          outputs,
          imagePrompt,
          selectedPlatforms,
          platformPreferences,
          usage: {
            tier: viewer.tier,
            usedThisMonth,
            monthlyLimit: viewer.monthlyLimit,
            remainingThisMonth,
            imageUsedThisMonth: viewer.imageUsedThisMonth,
            imageMonthlyLimit: viewer.imageMonthlyLimit,
            imageRemainingThisMonth: viewer.imageRemainingThisMonth,
            usageWindowLabel: viewer.usageWindowLabel
          }
        });
      } catch (error) {
        send("error", { error: error instanceof Error ? error.message : "Something went wrong while generating content." });
      } finally {
        if (releaseLease) {
          await releaseGenerationSlot(releaseLease.slotId, releaseLease.ownerKey);
        }
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
