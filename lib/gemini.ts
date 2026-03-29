import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import {
  type ContentPlatform,
  type ContentTone,
  type LengthPreset
} from "@/lib/plans";
import { limitCharacters } from "@/lib/utils";

const generationResponseSchema = z.object({
  outputs: z.object({
    linkedin: z.string().min(1).optional(),
    x: z.string().min(1).optional(),
    instagram: z.string().min(1).optional(),
    reddit: z.string().min(1).optional(),
    newsletter: z.string().min(1).optional()
  }),
  imagePrompt: z.string().min(1)
});

export type PlatformOutputs = Partial<Record<ContentPlatform, string>>;

function buildResponseJsonSchema(platforms: ContentPlatform[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["outputs", "imagePrompt"],
    properties: {
      outputs: {
        type: "object",
        additionalProperties: false,
        required: platforms,
        properties: Object.fromEntries(platforms.map((platform) => [platform, { type: "string" }]))
      },
      imagePrompt: {
        type: "string"
      }
    }
  };
}

const toneInstructions: Record<ContentTone, string> = {
  professional:
    "Use a credible, polished, business-ready voice. Keep it sharp, practical, and composed.",
  casual:
    "Use a warm, conversational voice. Make it feel natural and easy to read without becoming sloppy.",
  viral:
    "Use a hook-first, high-energy style built for attention and shareability, but stay factual and grounded in the source.",
  authority:
    "Use an expert, confident, insight-led voice. Make it feel like strong thinking from someone who deeply understands the topic."
};

const lengthInstructions: Record<LengthPreset, string> = {
  short: "Keep each output clearly compressed. Prioritize the strongest ideas only.",
  medium: "Use a balanced amount of detail, structure, and breathing room.",
  long: "Expand with more context, transitions, examples from the source, and fuller development."
};

const lengthTargets: Record<LengthPreset, Record<ContentPlatform, string>> = {
  short: {
    linkedin: "around 80 to 140 words, 2 to 3 short paragraphs max",
    x: "a short thread of 3 to 5 posts, each punchy and compact",
    instagram: "around 70 to 130 words with a strong hook and tight caption flow",
    reddit: "around 120 to 180 words, direct and practical",
    newsletter: "around 140 to 220 words with headline, short summary, and compact body"
  },
  medium: {
    linkedin: "around 160 to 260 words, 3 to 5 short paragraphs",
    x: "a thread of 6 to 8 posts with a clear arc",
    instagram: "around 140 to 220 words with more story and context",
    reddit: "around 220 to 340 words with grounded detail",
    newsletter: "around 260 to 420 words with headline, summary, and developed body"
  },
  long: {
    linkedin: "around 280 to 420 words with fuller development and a stronger close",
    x: "a deeper thread of 9 to 12 posts with smooth progression",
    instagram: "around 240 to 380 words with richer storytelling and context",
    reddit: "around 380 to 550 words with detailed but natural explanation",
    newsletter: "around 500 to 800 words with a clear editorial flow"
  }
};

const platformInstructions: Record<ContentPlatform, string> = {
  linkedin:
    "LinkedIn: strong opening line, 3 to 5 short paragraphs, one compact bullet-style section if useful, and a thoughtful closing line or question.",
  x:
    "X: create a numbered thread with short posts separated by blank lines. Start with a strong opener and end with a concise takeaway.",
  instagram:
    "Instagram: create a caption with a strong hook, short visual-friendly lines, natural paragraph breaks, and a light hashtag section only if it genuinely fits the source.",
  reddit:
    "Reddit: write in a human, grounded, non-corporate way. Prioritize clarity, usefulness, and natural flow over hype.",
  newsletter:
    "Newsletter: start with a headline, add a short summary line, then write a concise, readable editorial-style body."
};

function getModelName() {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  return new GoogleGenAI({ apiKey });
}

function extractResponseText(response: unknown) {
  const candidate = response as
    | {
        text?: string | (() => string);
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
            }>;
          };
        }>;
      }
    | undefined;

  if (typeof candidate?.text === "string" && candidate.text.trim()) {
    return candidate.text;
  }

  if (typeof candidate?.text === "function") {
    const value = candidate.text();
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  const partsText =
    candidate?.candidates
      ?.flatMap((item) => item.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";

  return partsText;
}

function cleanJsonCandidate(raw: string) {
  return raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseStructuredJson(raw: string) {
  const cleaned = cleanJsonCandidate(raw);
  const attempts: string[] = [cleaned];

  const fencedMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    attempts.push(cleanJsonCandidate(fencedMatch[1]));
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    attempts.push(cleanJsonCandidate(cleaned.slice(firstBrace, lastBrace + 1)));
  }

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      return generationResponseSchema.parse(parsed);
    } catch {}
  }

  throw new Error("The model returned malformed JSON.");
}

function validateRequestedPlatforms(outputs: PlatformOutputs, platforms: ContentPlatform[]) {
  for (const platform of platforms) {
    const value = outputs[platform];
    if (!value || !value.trim()) {
      throw new Error(`The model did not return a usable ${platform} output.`);
    }
  }
}

function buildPrompt(input: {
  sourceTitle: string;
  sourceText: string;
  tone: ContentTone;
  lengthPreset: LengthPreset;
  platforms: ContentPlatform[];
  retryMode?: boolean;
}) {
  const requestedPlatformRules = input.platforms
    .map(
      (platform) =>
        `- ${platformInstructions[platform]} Target length for this request: ${lengthTargets[input.lengthPreset][platform]}.`
    )
    .join("\n");

  return `
You are a platform-specific content repurposing editor and visual concept assistant.

Your job is to transform one source into outputs for the requested platforms only, and also create one hidden image prompt for a matching visual.

Requested platforms:
${input.platforms.map((platform) => `- ${platform}`).join("\n")}

Tone:
${input.tone.toUpperCase()} — ${toneInstructions[input.tone]}

Length preset:
${input.lengthPreset.toUpperCase()} — ${lengthInstructions[input.lengthPreset]}

Non-negotiable source fidelity rules:
- Use only facts, claims, names, dates, examples, numbers, and ideas explicitly present in the source.
- Do not invent details.
- Do not add outside knowledge.
- Do not imply certainty where the source is uncertain.
- If the source is limited, keep the output limited instead of guessing.

Formatting rules:
- Return exactly one valid JSON object.
- No markdown code fences.
- No explanation before or after JSON.
- Include only the requested platform keys inside outputs.
- Every requested platform key must be present exactly once inside outputs.
- Each outputs value must be plain text.
- imagePrompt must be a single string.

Quality rules:
- Make SHORT, MEDIUM, and LONG feel materially different in depth, pacing, and total output size.
- Match the target length for each requested platform closely.
- Avoid filler, repetition, and generic motivational phrasing.
- Keep hooks, structure, and closing lines specific to each platform.

Image prompt rules:
- Write imagePrompt as 2 to 3 lines max.
- Describe a clear visual scene with subject, environment, composition, mood, and lighting.
- Make it polished, social-media ready, and strongly connected to the source.
- Do not repeat the post word-for-word.
- Do not include text overlays, logos, screenshots, UI, or watermarks.

Platform requirements:
${requestedPlatformRules}

${
  input.retryMode
    ? `Important retry instruction:
Your previous answer was not valid enough for the schema.
Return only one valid JSON object now, with every requested platform key filled and imagePrompt present.`
    : ""
}

Source title:
"""
${input.sourceTitle}
"""

Source text:
"""
${limitCharacters(input.sourceText, 26000)}
"""

Return strict JSON in this exact shape:
{
  "outputs": {
    "platform_name": "generated text"
  },
  "imagePrompt": "2-3 line visual prompt"
}
  `.trim();
}

async function requestGeneration(input: {
  sourceTitle: string;
  sourceText: string;
  tone: ContentTone;
  lengthPreset: LengthPreset;
  platforms: ContentPlatform[];
  retryMode?: boolean;
}) {
  const client = getClient();
  const model = getModelName();

  const response = await client.models.generateContent({
    model,
    contents: buildPrompt(input),
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: buildResponseJsonSchema(input.platforms),
      temperature: input.retryMode ? 0.2 : 0.5,
      maxOutputTokens: input.lengthPreset === "long" ? 5600 : input.lengthPreset === "medium" ? 4200 : 2600
    }
  });

  const rawText = extractResponseText(response);

  if (!rawText) {
    throw new Error("The model returned an empty response.");
  }

  const parsed = parseStructuredJson(rawText);
  validateRequestedPlatforms(parsed.outputs, input.platforms);

  const outputs = Object.fromEntries(
    input.platforms.map((platform) => [platform, parsed.outputs[platform]?.trim() ?? ""])
  ) as PlatformOutputs;

  return {
    outputs,
    imagePrompt: parsed.imagePrompt.trim(),
    modelName: model
  };
}

export async function generateRepurposedContent(input: {
  sourceTitle: string;
  sourceText: string;
  tone: ContentTone;
  lengthPreset: LengthPreset;
  platforms: ContentPlatform[];
}) {
  try {
    return await requestGeneration(input);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "The model returned malformed JSON." ||
        error.message.startsWith("The model did not return a usable"))
    ) {
      return await requestGeneration({
        ...input,
        retryMode: true
      });
    }

    throw error;
  }
}
