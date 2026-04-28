import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import {
  type ContentPlatform,
  type ContentTone,
  type LengthPreset
} from "@/lib/plans";
import { countWords, limitCharacters, sanitizeSourceText } from "@/lib/utils";

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

const summaryResponseSchema = z.object({
  summary: z.string().min(1)
});

export type PlatformOutputs = Partial<Record<ContentPlatform, string>>;

export type PlatformPreference = {
  tone: ContentTone;
  lengthPreset: LengthPreset;
};

const DIRECT_SOURCE_CHARACTER_LIMIT = 18000;
const DIRECT_SOURCE_WORD_LIMIT = 3200;
const CHUNK_CHARACTER_TARGET = 7000;
const CHUNK_CHARACTER_HARD_LIMIT = 8200;
const CHUNK_SUMMARY_CHARACTER_LIMIT = 2200;
const MASTER_SUMMARY_CHARACTER_LIMIT = 12000;

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

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  return new GoogleGenAI({ apiKey });
}

function extractResponseText(response: unknown) {
  if (!response || typeof response !== "object") return "";

  const r = response as {
    text?: unknown;
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  // @google/genai v1 SDK exposes `.text` as a string getter on the response
  if (typeof r.text === "string" && r.text.trim()) {
    return r.text;
  }

  // Defensive fallback: walk candidates → content → parts
  const partsText =
    r.candidates
      ?.flatMap((c) => c.content?.parts ?? [])
      .map((p) => p.text ?? "")
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

function parseSummaryJson(raw: string) {
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
      return summaryResponseSchema.parse(parsed);
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
  platformPreferences?: Partial<Record<ContentPlatform, PlatformPreference>>;
  retryMode?: boolean;
}) {
  const requestedPlatformRules = input.platforms
    .map((platform) => {
      const preference = input.platformPreferences?.[platform] ?? {
        tone: input.tone,
        lengthPreset: input.lengthPreset
      };

      return `- ${platform}: tone ${preference.tone}, length ${preference.lengthPreset}. ${platformInstructions[platform]} Target length for this request: ${lengthTargets[preference.lengthPreset][platform]}.`;
    })
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

function needsCompression(sourceText: string) {
  const normalized = sanitizeSourceText(sourceText);
  return (
    normalized.length > DIRECT_SOURCE_CHARACTER_LIMIT ||
    countWords(normalized) > DIRECT_SOURCE_WORD_LIMIT
  );
}

function splitIntoChunks(sourceText: string) {
  const normalized = sanitizeSourceText(sourceText);
  const paragraphs = normalized
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim()) {
      chunks.push(current.trim());
      current = "";
    }
  };

  const splitOversizedParagraph = (paragraph: string) => {
    const sentences = paragraph.match(/[^.!?\n]+[.!?]?/g)?.map((item) => item.trim()).filter(Boolean) ?? [paragraph];
    let sentenceChunk = "";

    for (const sentence of sentences) {
      const candidate = sentenceChunk ? `${sentenceChunk} ${sentence}` : sentence;
      if (candidate.length <= CHUNK_CHARACTER_TARGET) {
        sentenceChunk = candidate;
        continue;
      }

      if (sentenceChunk) {
        chunks.push(sentenceChunk.trim());
      }

      if (sentence.length <= CHUNK_CHARACTER_TARGET) {
        sentenceChunk = sentence;
        continue;
      }

      let start = 0;
      while (start < sentence.length) {
        const slice = sentence.slice(start, start + CHUNK_CHARACTER_TARGET);
        chunks.push(slice.trim());
        start += CHUNK_CHARACTER_TARGET;
      }
      sentenceChunk = "";
    }

    if (sentenceChunk.trim()) {
      chunks.push(sentenceChunk.trim());
    }
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > CHUNK_CHARACTER_HARD_LIMIT) {
      pushCurrent();
      splitOversizedParagraph(paragraph);
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= CHUNK_CHARACTER_TARGET) {
      current = candidate;
    } else {
      pushCurrent();
      current = paragraph;
    }
  }

  pushCurrent();

  return chunks.length ? chunks : [limitCharacters(normalized, CHUNK_CHARACTER_TARGET)];
}

function buildChunkSummaryPrompt(input: {
  sourceTitle: string;
  chunkText: string;
  chunkIndex: number;
  totalChunks: number;
}) {
  return `
You are compressing one chunk of a long source before a later content-generation step.

Goal:
- Preserve the most important facts, claims, examples, numbers, and takeaways from this chunk only.
- Remove repetition, filler, and tangents.
- Do not invent details.
- Do not add outside knowledge.

Output rules:
- Return exactly one valid JSON object.
- Use the key "summary".
- Write a compact but information-dense summary in plain text.
- Prefer short paragraphs or semicolon-separated sentences over bullets.
- Keep names, numbers, dates, examples, and concrete insights when present.
- Stay grounded in this chunk only.

Source title:
"""
${input.sourceTitle}
"""

Chunk ${input.chunkIndex} of ${input.totalChunks}:
"""
${limitCharacters(input.chunkText, 9000)}
"""

Return JSON in this exact shape:
{
  "summary": "compressed chunk summary"
}
  `.trim();
}

function buildMasterSummaryPrompt(input: {
  sourceTitle: string;
  chunkSummaries: string[];
}) {
  return `
You are merging chunk summaries from one long source into a single master source summary for later repurposing.

Goal:
- Combine the chunk summaries into one faithful, compact master summary.
- Preserve major themes, strongest examples, names, numbers, dates, and important nuance.
- Remove repetition and overlap.
- Keep the result rich enough for content generation across multiple platforms.
- Do not invent details or add outside knowledge.

Output rules:
- Return exactly one valid JSON object.
- Use the key "summary".
- Write clear plain text, not markdown.
- Keep it concise but information-dense.
- Favor readable paragraphs over bullets.

Source title:
"""
${input.sourceTitle}
"""

Chunk summaries:
"""
${input.chunkSummaries.map((summary, index) => `[Chunk ${index + 1}] ${summary}`).join("\n\n")}
"""

Return JSON in this exact shape:
{
  "summary": "master summary"
}
  `.trim();
}


const DEFAULT_GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

function normalizeModelName(value: string | undefined | null) {
  const model = value?.trim();
  if (!model) return null;

  // Keep this small and explicit so unsupported legacy model names do not break generation.
  const supportedModels = new Set(DEFAULT_GEMINI_MODELS);
  return supportedModels.has(model) ? model : null;
}

function getModelCandidates() {
  const primary = normalizeModelName(process.env.GEMINI_MODEL) ?? DEFAULT_GEMINI_MODELS[0];
  const fallbackModels = process.env.GEMINI_FALLBACK_MODELS?.split(",")
    .map((value) => normalizeModelName(value))
    .filter((value): value is string => Boolean(value)) ?? [];

  return [...new Set([primary, ...fallbackModels, ...DEFAULT_GEMINI_MODELS])];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "");
}

function isTransientGeminiError(error: unknown) {
  const message = getErrorMessage(error);
  const record = error as {
    status?: unknown;
    code?: unknown;
    response?: { status?: unknown };
  } | null;
  const status = Number(record?.status ?? record?.response?.status ?? record?.code);

  return (
    [429, 500, 502, 503, 504].includes(status) ||
    /high demand|unavailable|resource_exhausted|rate limit|temporarily unavailable|service unavailable|overloaded/i.test(
      message
    )
  );
}

function shouldTryAnotherModel(error: unknown) {
  const message = getErrorMessage(error);

  return (
    isTransientGeminiError(error) ||
    /malformed JSON|empty response|did not return a usable|invalid JSON|failed validation/i.test(message)
  );
}

function getFriendlyGeminiError(error: unknown) {
  if (isTransientGeminiError(error)) {
    return "The content engine is busy right now. Please try again in a moment.";
  }

  const message = getErrorMessage(error).trim();
  return message || "Something went wrong while generating content.";
}

async function requestSummary(
  prompt: string,
  maxOutputTokens: number,
  modelName: string,
  retryMode = false
) {
  const client = getClient();

  const response = await client.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["summary"],
        properties: {
          summary: {
            type: "string"
          }
        }
      },
      temperature: retryMode ? 0.2 : 0.3,
      maxOutputTokens
    }
  });

  const rawText = extractResponseText(response);

  if (!rawText) {
    throw new Error("The model returned an empty response.");
  }

  const parsed = parseSummaryJson(rawText);
  return parsed.summary.trim();
}

async function requestSummaryWithFallback(prompt: string, maxOutputTokens: number) {
  const models = getModelCandidates();
  let lastError: unknown = null;

  for (const model of models) {
    try {
      return await requestSummary(prompt, maxOutputTokens, model, false);
    } catch (error) {
      lastError = error;

      if (shouldTryAnotherModel(error)) {
        await sleep(350);

        try {
          return await requestSummary(prompt, maxOutputTokens, model, true);
        } catch (retryError) {
          lastError = retryError;
        }
      }
    }
  }

  throw new Error(getFriendlyGeminiError(lastError));
}

async function compressLongSource(input: {
  sourceTitle: string;
  sourceText: string;
}) {
  const chunks = splitIntoChunks(input.sourceText);

  if (chunks.length === 1 && chunks[0] && chunks[0].length <= DIRECT_SOURCE_CHARACTER_LIMIT) {
    return sanitizeSourceText(chunks[0]);
  }

  const chunkSummaries: string[] = [];

  for (const [index, chunkText] of chunks.entries()) {
    const summary = await requestSummaryWithFallback(
      buildChunkSummaryPrompt({
        sourceTitle: input.sourceTitle,
        chunkText,
        chunkIndex: index + 1,
        totalChunks: chunks.length
      }),
      1100
    );

    chunkSummaries.push(limitCharacters(summary, CHUNK_SUMMARY_CHARACTER_LIMIT));
  }

  const mergedSummary =
    chunkSummaries.length === 1
      ? chunkSummaries[0]
      : await requestSummaryWithFallback(
          buildMasterSummaryPrompt({
            sourceTitle: input.sourceTitle,
            chunkSummaries
          }),
          2200
        );

  return limitCharacters(sanitizeSourceText(mergedSummary), MASTER_SUMMARY_CHARACTER_LIMIT);
}

async function prepareSourceText(input: {
  sourceTitle: string;
  sourceText: string;
}) {
  const normalized = sanitizeSourceText(input.sourceText);

  if (!needsCompression(normalized)) {
    return normalized;
  }

  return await compressLongSource({
    sourceTitle: input.sourceTitle,
    sourceText: normalized
  });
}

async function requestGeneration(input: {
  sourceTitle: string;
  sourceText: string;
  tone: ContentTone;
  lengthPreset: LengthPreset;
  platforms: ContentPlatform[];
  platformPreferences?: Partial<Record<ContentPlatform, PlatformPreference>>;
  retryMode?: boolean;
}, modelName: string) {
  const client = getClient();

  const response = await client.models.generateContent({
    model: modelName,
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
    modelName
  };
}

async function requestGenerationWithFallback(input: {
  sourceTitle: string;
  sourceText: string;
  tone: ContentTone;
  lengthPreset: LengthPreset;
  platforms: ContentPlatform[];
  platformPreferences?: Partial<Record<ContentPlatform, PlatformPreference>>;
}) {
  const models = getModelCandidates();
  let lastError: unknown = null;

  for (const model of models) {
    try {
      return await requestGeneration({ ...input, retryMode: false }, model);
    } catch (error) {
      lastError = error;

      if (shouldTryAnotherModel(error)) {
        await sleep(350);

        try {
          return await requestGeneration({ ...input, retryMode: true }, model);
        } catch (retryError) {
          lastError = retryError;
        }
      }
    }
  }

  throw new Error(getFriendlyGeminiError(lastError));
}

export async function generateRepurposedContent(input: {
  sourceTitle: string;
  sourceText: string;
  tone: ContentTone;
  lengthPreset: LengthPreset;
  platforms: ContentPlatform[];
  platformPreferences?: Partial<Record<ContentPlatform, PlatformPreference>>;
}) {
  const preparedSourceText = await prepareSourceText({
    sourceTitle: input.sourceTitle,
    sourceText: input.sourceText
  });

  return await requestGenerationWithFallback({
    ...input,
    sourceText: preparedSourceText
  });
}
