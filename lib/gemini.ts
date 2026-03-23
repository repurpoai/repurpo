import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { limitCharacters } from "@/lib/utils";
import { type ContentTone } from "@/lib/plans";

const repurposedContentSchema = z.object({
  linkedin_post: z.string().min(1),
  twitter_thread: z.string().min(1),
  newsletter: z.string().min(1)
});

const repurposedContentJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    linkedin_post: {
      type: "string",
      description:
        "A polished LinkedIn post in plain text with distinct structure, natural spacing, and a strong opening."
    },
    twitter_thread: {
      type: "string",
      description:
        "A numbered Twitter/X thread in plain text with 6 to 8 short posts separated by blank lines."
    },
    newsletter: {
      type: "string",
      description:
        "A newsletter-ready piece in plain text with a headline, a short summary section, and a readable body."
    }
  },
  required: ["linkedin_post", "twitter_thread", "newsletter"]
};

const toneInstructions: Record<ContentTone, string> = {
  professional:
    "Use a credible, polished, business-ready voice. Keep it sharp, practical, and composed.",
  casual:
    "Use a warm, conversational voice. Make it feel natural and easy to read without becoming sloppy.",
  viral:
    "Use a hook-first, high-energy style that is built for attention and shareability, but stay factual and grounded in the source.",
  authority:
    "Use an expert, confident, insight-led voice. Make it feel like a strong point of view from someone who deeply understands the topic."
};

export type RepurposedContent = z.infer<typeof repurposedContentSchema>;

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
      return repurposedContentSchema.parse(parsed);
    } catch {}
  }

  throw new Error("The model returned malformed JSON.");
}

function buildPrompt(input: {
  sourceTitle: string;
  sourceText: string;
  tone: ContentTone;
  retryMode?: boolean;
}) {
  return `
You are a content repurposing editor.

Your job is to transform one source into three distinct outputs:
1. LinkedIn post
2. Twitter/X thread
3. Newsletter version

Tone to use:
${input.tone.toUpperCase()} — ${toneInstructions[input.tone]}

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
- No extra keys.
- Each field must be plain text.

Output requirements:

linkedin_post:
- Strong first-line hook
- 3 to 5 short paragraphs
- Include one compact bullet-style section if it improves clarity
- End with a thoughtful closing line or question
- Roughly 120 to 220 words
- Must feel native to LinkedIn

twitter_thread:
- 6 to 8 posts
- Number each post like 1/6, 2/6, etc.
- Separate each post with a blank line
- Keep each post punchy and scannable
- Start with a strong opener
- End with a concise final takeaway
- Must feel native to X/Twitter

newsletter:
- Start with a headline
- Add a short summary line under it
- Then write a concise, readable newsletter body
- Use short paragraphs and strong transitions
- Include a "Why it matters" style angle if supported by the source
- Must feel native to newsletters

${
  input.retryMode
    ? `Important retry instruction:
Your previous answer was not valid JSON.
Return only a single valid JSON object now.`
    : ""
}

Source title:
${input.sourceTitle}

Source text:
${limitCharacters(input.sourceText, 22000)}
  `.trim();
}

async function requestGeneration(input: {
  sourceTitle: string;
  sourceText: string;
  tone: ContentTone;
  retryMode?: boolean;
}) {
  const client = getClient();
  const model = getModelName();

  const response = await client.models.generateContent({
    model,
    contents: buildPrompt(input),
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: repurposedContentJsonSchema,
      temperature: input.retryMode ? 0.2 : 0.5,
      maxOutputTokens: 3600
    }
  });

  const rawText = extractResponseText(response);

  if (!rawText) {
    throw new Error("The model returned an empty response.");
  }

  const parsed = parseStructuredJson(rawText);

  return {
    ...parsed,
    modelName: model
  };
}

export async function generateRepurposedContent(input: {
  sourceTitle: string;
  sourceText: string;
  tone: ContentTone;
}) {
  try {
    return await requestGeneration(input);
  } catch (error) {
    if (error instanceof Error && error.message === "The model returned malformed JSON.") {
      return await requestGeneration({
        ...input,
        retryMode: true
      });
    }

    throw error;
  }
}
