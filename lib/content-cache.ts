import crypto from "node:crypto";
import { getRedisClient } from "@/lib/upstash";
import { type ContentPlatform, type ContentTone, type LengthPreset } from "@/lib/plans";

export type PlatformGenerationCacheRecord = {
  output: string;
  imagePrompt: string;
  sourceFingerprint: string;
  platform: ContentPlatform;
  tone: ContentTone;
  lengthPreset: LengthPreset;
  sourceTitle: string;
  sourceUrl: string | null;
  createdAt: string;
  expiresAt: string;
};

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

function normalizeSourceUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    url.hash = "";
    return url.toString();
  } catch {
    return trimmed.toLowerCase();
  }
}

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function makeGenerationSourceFingerprint(input: {
  sourceUrl?: string | null;
  sourceText: string;
  sourceKind?: string | null;
}) {
  const payload = JSON.stringify({
    kind: input.sourceKind ?? "unknown",
    url: normalizeSourceUrl(input.sourceUrl),
    text: input.sourceText.trim()
  });

  return hash(payload);
}

export function makePlatformGenerationCacheKey(input: {
  sourceFingerprint: string;
  platform: ContentPlatform;
  tone: ContentTone;
  lengthPreset: LengthPreset;
}) {
  return `repurpo:platform-gen:${hash(JSON.stringify(input))}`;
}

function parseRecord(raw: unknown): PlatformGenerationCacheRecord | null {
  if (!raw) return null;

  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== "object") return null;
  const record = value as Partial<PlatformGenerationCacheRecord>;

  if (
    typeof record.output !== "string" ||
    typeof record.imagePrompt !== "string" ||
    typeof record.sourceFingerprint !== "string" ||
    typeof record.platform !== "string" ||
    typeof record.tone !== "string" ||
    typeof record.lengthPreset !== "string" ||
    typeof record.sourceTitle !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.expiresAt !== "string"
  ) {
    return null;
  }

  return {
    output: record.output,
    imagePrompt: record.imagePrompt,
    sourceFingerprint: record.sourceFingerprint,
    platform: record.platform as ContentPlatform,
    tone: record.tone as ContentTone,
    lengthPreset: record.lengthPreset as LengthPreset,
    sourceTitle: record.sourceTitle,
    sourceUrl: typeof record.sourceUrl === "string" ? record.sourceUrl : null,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt
  };
}

export async function readPlatformGenerationCache(cacheKey: string) {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const raw = await redis.get(cacheKey);
    const parsed = parseRecord(raw);
    if (!parsed) return null;

    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function storePlatformGenerationCache(options: {
  cacheKey: string;
  sourceFingerprint: string;
  platform: ContentPlatform;
  tone: ContentTone;
  lengthPreset: LengthPreset;
  output: string;
  imagePrompt: string;
  sourceTitle: string;
  sourceUrl: string | null;
}) {
  const redis = getRedisClient();
  if (!redis) return false;

  try {
    const now = new Date().toISOString();
    const payload: PlatformGenerationCacheRecord = {
      output: options.output,
      imagePrompt: options.imagePrompt,
      sourceFingerprint: options.sourceFingerprint,
      platform: options.platform,
      tone: options.tone,
      lengthPreset: options.lengthPreset,
      sourceTitle: options.sourceTitle,
      sourceUrl: options.sourceUrl,
      createdAt: now,
      expiresAt: new Date(Date.now() + CACHE_TTL_SECONDS * 1000).toISOString()
    };

    await redis.set(options.cacheKey, JSON.stringify(payload), { ex: CACHE_TTL_SECONDS });
    return true;
  } catch (error) {
    console.warn("Could not store generation cache in Upstash Redis:", error);
    return false;
  }
}
