"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { extractArticleFromUrl } from "@/lib/extract-article";
import { generateRepurposedContent } from "@/lib/gemini";
import { canUseTone, getMonthRange, TONES, type ContentTone, type PlanTier } from "@/lib/plans";
import { countWords, sanitizeSourceText } from "@/lib/utils";
import { getViewerContext } from "@/lib/viewer";

type InputMode = "link" | "text";

type UsageState = {
  tier: PlanTier;
  usedThisMonth: number;
  monthlyLimit: number | null;
  remainingThisMonth: number | null;
  usageWindowLabel: string;
};

export type GenerationFormState = {
  success: boolean;
  error: string | null;
  data: {
    inputMode: InputMode;
    tone: ContentTone;
    sourceTitle: string;
    sourceUrl: string | null;
    linkedinPost: string;
    twitterThread: string;
    newsletter: string;
  } | null;
  usage: UsageState | null;
};

export const initialGenerationFormState: GenerationFormState = {
  success: false,
  error: null,
  data: null,
  usage: null
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

  const mode = formData.get("mode") === "link" ? "link" : "text";

  const toneParse = toneSchema.safeParse(formData.get("tone"));
  const tone = toneParse.success ? toneParse.data : "professional";

  if (!canUseTone(viewer.tier, tone)) {
    return {
      success: false,
      error: "That tone is available on Pro only.",
      data: null,
      usage: {
        tier: viewer.tier,
        usedThisMonth: viewer.usedThisMonth,
        monthlyLimit: viewer.monthlyLimit,
        remainingThisMonth: viewer.remainingThisMonth,
        usageWindowLabel: viewer.usageWindowLabel
      }
    };
  }

  if (viewer.monthlyLimit !== null && viewer.usedThisMonth >= viewer.monthlyLimit) {
    return {
      success: false,
      error: "You have reached your monthly Free plan limit. Upgrade to Pro for unlimited generations.",
      data: null,
      usage: {
        tier: viewer.tier,
        usedThisMonth: viewer.usedThisMonth,
        monthlyLimit: viewer.monthlyLimit,
        remainingThisMonth: 0,
        usageWindowLabel: viewer.usageWindowLabel
      }
    };
  }

  let sourceTitle = "";
  let sourceUrl: string | null = null;
  let sourceText = "";

  if (mode === "link") {
    const parsedUrl = urlSchema.safeParse(formData.get("url"));

    if (!parsedUrl.success) {
      return {
        success: false,
        error: parsedUrl.error.issues[0]?.message ?? "Enter a valid URL.",
        data: null,
        usage: {
          tier: viewer.tier,
          usedThisMonth: viewer.usedThisMonth,
          monthlyLimit: viewer.monthlyLimit,
          remainingThisMonth: viewer.remainingThisMonth,
          usageWindowLabel: viewer.usageWindowLabel
        }
      };
    }

    try {
      const article = await extractArticleFromUrl(parsedUrl.data);
      sourceTitle = article.title;
      sourceUrl = article.url;
      sourceText = article.text;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not extract readable content from that URL.",
        data: null,
        usage: {
          tier: viewer.tier,
          usedThisMonth: viewer.usedThisMonth,
          monthlyLimit: viewer.monthlyLimit,
          remainingThisMonth: viewer.remainingThisMonth,
          usageWindowLabel: viewer.usageWindowLabel
        }
      };
    }
  } else {
    const parsedText = textSchema.safeParse(formData.get("text"));

    if (!parsedText.success) {
      return {
        success: false,
        error: parsedText.error.issues[0]?.message ?? "Invalid source text.",
        data: null,
        usage: {
          tier: viewer.tier,
          usedThisMonth: viewer.usedThisMonth,
          monthlyLimit: viewer.monthlyLimit,
          remainingThisMonth: viewer.remainingThisMonth,
          usageWindowLabel: viewer.usageWindowLabel
        }
      };
    }

    sourceTitle = "Manual text input";
    sourceText = parsedText.data;
  }

  try {
    const generated = await generateRepurposedContent({
      sourceTitle,
      sourceText,
      tone
    });

    const supabase = await createClient();

    const { error: insertError } = await supabase.from("generations").insert({
      user_id: viewer.userId,
      input_mode: mode,
      tone,
      source_url: sourceUrl,
      source_title: sourceTitle,
      source_text: sourceText,
      linkedin_post: generated.linkedin_post,
      twitter_thread: generated.twitter_thread,
      newsletter: generated.newsletter,
      model_name: generated.modelName
    });

    revalidatePath("/history");
    revalidatePath("/dashboard");

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
        sourceTitle,
        sourceUrl,
        linkedinPost: generated.linkedin_post,
        twitterThread: generated.twitter_thread,
        newsletter: generated.newsletter
      },
      usage: {
        tier: viewer.tier,
        usedThisMonth,
        monthlyLimit: viewer.monthlyLimit,
        remainingThisMonth,
        usageWindowLabel: viewer.usageWindowLabel
      }
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong while generating content.",
      data: null,
      usage: {
        tier: viewer.tier,
        usedThisMonth: viewer.usedThisMonth,
        monthlyLimit: viewer.monthlyLimit,
        remainingThisMonth: viewer.remainingThisMonth,
        usageWindowLabel: viewer.usageWindowLabel
      }
    };
  }
}