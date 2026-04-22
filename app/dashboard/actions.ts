"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { extractArticleFromUrl } from "@/lib/extract-article";
import { generateRepurposedContent, type PlatformOutputs } from "@/lib/gemini";
import {
  canUseTone,
  CONTENT_PLATFORMS,
  LENGTH_PRESETS,
  TONES,
  type ContentPlatform,
  type ContentTone,
  type LengthPreset,
  type PlanTier
} from "@/lib/plans";
import { countWords, sanitizeSourceText } from "@/lib/utils";
import { getViewerContext, type ViewerContext } from "@/lib/viewer";
import { extractYouTubeTranscript } from "@/lib/youtube";
import { logActivity } from "@/lib/activity";

type InputMode = "link" | "text" | "youtube";

type UsageState = {
  tier: PlanTier;
  usedThisMonth: number;
  monthlyLimit: number | null;
  remainingThisMonth: number | null;
  imageUsedThisMonth: number;
  imageMonthlyLimit: number | null;
  imageRemainingThisMonth: number | null;
  usageWindowLabel: string;
};

function buildUsageState(
  viewer: ViewerContext | null,
  overrides?: Partial<UsageState>
): UsageState | null {
  if (!viewer) return null;

  return {
    tier: viewer.tier,
    usedThisMonth: viewer.usedThisMonth,
    monthlyLimit: viewer.monthlyLimit,
    remainingThisMonth: viewer.remainingThisMonth,
    imageUsedThisMonth: viewer.imageUsedThisMonth,
    imageMonthlyLimit: viewer.imageMonthlyLimit,
    imageRemainingThisMonth: viewer.imageRemainingThisMonth,
    usageWindowLabel: viewer.usageWindowLabel,
    ...overrides
  };
}

export type GenerationFormState = {
  success: boolean;
  error: string | null;
  data: {
    inputMode: InputMode;
    tone: ContentTone;
    lengthPreset: LengthPreset;
    sourceTitle: string;
    sourceUrl: string | null;
    outputs: PlatformOutputs;
    imagePrompt: string;
    selectedPlatforms: ContentPlatform[];
  } | null;
  usage: UsageState | null;
};

const urlSchema = z
  .string({ required_error: "Enter a URL first." })
  .trim()
  .url("Enter a valid URL.")
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  }, "Only http and https URLs are supported.");

const textSchema = z
  .string({ required_error: "Paste some source text first." })
  .transform((value) => sanitizeSourceText(value))
  .refine((value) => value.length >= 400, {
    message: "Source text is too short. Paste at least a few solid paragraphs."
  })
  .refine((value) => countWords(value) <= 5000, {
    message: "Source text is too long. Keep it under about 5000 words."
  });

const toneSchema = z.enum(TONES);
const lengthSchema = z.enum(LENGTH_PRESETS);
const platformsSchema = z.array(z.enum(CONTENT_PLATFORMS)).min(1, "Select at least one platform.");

export async function generateContentAction(
  _: GenerationFormState,
  formData: FormData
): Promise<GenerationFormState> {
  const viewer = await getViewerContext();

  if (!viewer) {
    return {
      success: false,
      error: "Your session expired. Log in again.",
      data: null,
      usage: null
    };
  }

  const mode = formData.get("mode") === "youtube"
    ? "youtube"
    : formData.get("mode") === "link"
    ? "link"
    : "text";

  const toneParse = toneSchema.safeParse(formData.get("tone"));
  const tone = toneParse.success ? toneParse.data : "professional";

  const lengthParse = lengthSchema.safeParse(formData.get("lengthPreset"));
  const lengthPreset = lengthParse.success ? lengthParse.data : "medium";

  const selectedPlatformsRaw = formData.getAll("platforms").map(String);
  const platformsParse = platformsSchema.safeParse(selectedPlatformsRaw);

  if (!platformsParse.success) {
    return {
      success: false,
      error: platformsParse.error.issues[0]?.message ?? "Select at least one platform.",
      data: null,
      usage: buildUsageState(viewer)
    };
  }

  const selectedPlatforms = platformsParse.data;

  if (!canUseTone(viewer.tier, tone)) {
    return {
      success: false,
      error: "That tone is available on paid plans only.",
      data: null,
      usage: buildUsageState(viewer)
    };
  }

  if (viewer.monthlyLimit !== null && viewer.usedThisMonth >= viewer.monthlyLimit) {
    return {
      success: false,
      error: "You have reached your monthly Free plan limit. Upgrade to continue generating.",
      data: null,
      usage: buildUsageState(viewer, { remainingThisMonth: 0 })
    };
  }

  let sourceTitle = "";
  let sourceUrl: string | null = null;
  let sourceText = "";
  let sourceMeta: Record<string, unknown> = {};

  if (mode === "link") {
    const parsedUrl = urlSchema.safeParse(formData.get("url"));

    if (!parsedUrl.success) {
      return {
        success: false,
        error: parsedUrl.error.issues[0]?.message ?? "Enter a valid URL.",
        data: null,
        usage: buildUsageState(viewer)
      };
    }

    try {
      const article = await extractArticleFromUrl(parsedUrl.data);
      sourceTitle = article.title;
      sourceUrl = article.url;
      sourceText = article.text;
      sourceMeta = { kind: "article" };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not extract readable content from that URL.",
        data: null,
        usage: buildUsageState(viewer)
      };
    }
  } else if (mode === "youtube") {
    const parsedUrl = urlSchema.safeParse(formData.get("youtubeUrl"));

    if (!parsedUrl.success) {
      return {
        success: false,
        error: parsedUrl.error.issues[0]?.message ?? "Enter a valid YouTube URL.",
        data: null,
        usage: buildUsageState(viewer)
      };
    }

    try {
      const video = await extractYouTubeTranscript(parsedUrl.data);
      sourceTitle = video.title;
      sourceUrl = video.url;
      sourceText = video.text;
      sourceMeta = video.sourceMeta;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not fetch a usable YouTube transcript.",
        data: null,
        usage: buildUsageState(viewer)
      };
    }
  } else {
    const parsedText = textSchema.safeParse(formData.get("text"));

    if (!parsedText.success) {
      return {
        success: false,
        error: parsedText.error.issues[0]?.message ?? "Invalid source text.",
        data: null,
        usage: buildUsageState(viewer)
      };
    }

    sourceTitle = "Manual text input";
    sourceText = parsedText.data;
    sourceMeta = { kind: "manual" };
  }

  try {
    const generated = await generateRepurposedContent({
      sourceTitle,
      sourceText,
      tone,
      lengthPreset,
      platforms: selectedPlatforms
    });

    const supabase = await createClient();

    const { error: insertError } = await supabase.from("generations").insert({
      user_id: viewer.userId,
      input_mode: mode,
      tone,
      length_preset: lengthPreset,
      source_url: sourceUrl,
      source_title: sourceTitle,
      source_text: sourceText,
      source_meta: sourceMeta,
      selected_platforms: selectedPlatforms,
      outputs: generated.outputs,
      linkedin_post: generated.outputs.linkedin ?? "",
      twitter_thread: generated.outputs.x ?? "",
      newsletter: generated.outputs.newsletter ?? "",
      model_name: generated.modelName
    });

    revalidatePath("/history");
    revalidatePath("/dashboard");
    revalidatePath("/profile");

    await logActivity({
      actorUserId: viewer.userId,
      action: "generation_success",
      metadata: {
        mode,
        tone,
        lengthPreset,
        selectedPlatforms,
        sourceKind: sourceMeta.kind ?? null
      }
    });

    const usedThisMonth = insertError ? viewer.usedThisMonth : viewer.usedThisMonth + 1;
    const remainingThisMonth =
      viewer.monthlyLimit === null
        ? null
        : Math.max(viewer.monthlyLimit - usedThisMonth, 0);

    return {
      success: true,
      error: insertError ? "Generated content, but saving to history failed." : null,
      data: {
        inputMode: mode,
        tone,
        lengthPreset,
        sourceTitle,
        sourceUrl,
        outputs: generated.outputs,
        imagePrompt: generated.imagePrompt,
        selectedPlatforms
      },
      usage: buildUsageState(viewer, { usedThisMonth, remainingThisMonth })
    };
  } catch (error) {
    console.error("generateContentAction failed:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong while generating content.",
      data: null,
      usage: buildUsageState(viewer)
    };
  }
}
