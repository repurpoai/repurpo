import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRedisClient } from "@/lib/upstash";
import { type ContentPlatform, type ContentTone, type LengthPreset } from "@/lib/plans";

export type ExtractionCacheKind = "article" | "youtube";

export type CachedExtraction = {
  url: string;
  title: string;
  text: string;
  sourceMeta: Record<string, unknown>;
};

type ExtractionCacheRow = {
  source_url: string;
  source_title: string;
  source_text: string;
  source_meta: Record<string, unknown> | null;
  expires_at: string;
};

type RedisExtractionCachePayload = {
  url: string;
  title: string;
  text: string;
  sourceMeta: Record<string, unknown>;
  expiresAt: string;
};

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

export function makeExtractionCacheKey(kind: ExtractionCacheKind, value: string) {
  const normalized = value.trim().toLowerCase();
  const digest = hash(normalized);
  return `${kind}:${digest}`;
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

function parseSourceMeta(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as Record<string, unknown>;
}

function parseRedisExtractionPayload(raw: unknown): RedisExtractionCachePayload | null {
  if (!raw) {
    return null;
  }

  let value: unknown = raw;

  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<RedisExtractionCachePayload>;
  if (
    typeof record.url !== "string" ||
    typeof record.title !== "string" ||
    typeof record.text !== "string" ||
    typeof record.expiresAt !== "string"
  ) {
    return null;
  }

  return {
    url: record.url,
    title: record.title,
    text: record.text,
    sourceMeta: parseSourceMeta(record.sourceMeta),
    expiresAt: record.expiresAt
  };
}

function parsePlatformGenerationRecord(raw: unknown): PlatformGenerationCacheRecord | null {
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

function isMissingTableError(error: unknown) {
  const record = error as {
    code?: string;
    message?: string;
    details?: string;
  } | null;

  const haystack = `${record?.code ?? ""} ${record?.message ?? ""} ${record?.details ?? ""}`.toLowerCase();

  return (
    record?.code === "42P01" ||
    record?.code === "PGRST116" ||
    haystack.includes('relation "public.content_extraction_cache" does not exist') ||
    haystack.includes('relation "content_extraction_cache" does not exist') ||
    haystack.includes("could not find the table") ||
    haystack.includes("could not find the function") ||
    haystack.includes("schema cache") ||
    haystack.includes("rpc")
  );
}

async function readExtractionFromRedis(cacheKey: string): Promise<CachedExtraction | null> {
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  try {
    const raw = await redis.get(cacheKey);
    const parsed = parseRedisExtractionPayload(raw);
    if (!parsed || new Date(parsed.expiresAt).getTime() <= Date.now()) {
      return null;
    }

    return {
      url: parsed.url,
      title: parsed.title,
      text: parsed.text,
      sourceMeta: parsed.sourceMeta
    };
  } catch {
    return null;
  }
}

async function writeExtractionToRedis(options: {
  cacheKey: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceText: string;
  sourceMeta: Record<string, unknown>;
  ttlSeconds: number;
}) {
  const redis = getRedisClient();
  if (!redis) {
    return false;
  }

  try {
    const ttlSeconds = Math.max(options.ttlSeconds, 300);
    const payload: RedisExtractionCachePayload = {
      url: options.sourceUrl,
      title: options.sourceTitle,
      text: options.sourceText,
      sourceMeta: options.sourceMeta,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
    };

    await redis.set(options.cacheKey, JSON.stringify(payload), { ex: ttlSeconds });
    return true;
  } catch (error) {
    console.warn("Could not store extraction cache in Upstash Redis:", error);
    return false;
  }
}

export async function readExtractionCache(cacheKey: string, kind: ExtractionCacheKind): Promise<CachedExtraction | null> {
  const redisHit = await readExtractionFromRedis(cacheKey);
  if (redisHit) {
    return redisHit;
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("content_extraction_cache")
      .select("source_url, source_title, source_text, source_meta, expires_at")
      .eq("cache_key", cacheKey)
      .eq("source_kind", kind)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const row = data as ExtractionCacheRow;
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return null;
    }

    return {
      url: row.source_url,
      title: row.source_title,
      text: row.source_text,
      sourceMeta: parseSourceMeta(row.source_meta)
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      return null;
    }

    return null;
  }
}

export async function storeExtractionCache(options: {
  cacheKey: string;
  kind: ExtractionCacheKind;
  sourceUrl: string;
  sourceTitle: string;
  sourceText: string;
  sourceMeta: Record<string, unknown>;
  ttlSeconds: number;
}) {
  const redisStored = await writeExtractionToRedis({
    cacheKey: options.cacheKey,
    sourceUrl: options.sourceUrl,
    sourceTitle: options.sourceTitle,
    sourceText: options.sourceText,
    sourceMeta: options.sourceMeta,
    ttlSeconds: options.ttlSeconds
  });

  if (redisStored) {
    return;
  }

  try {
    const admin = createAdminClient();
    const expiresAt = new Date(Date.now() + Math.max(options.ttlSeconds, 300) * 1000).toISOString();

    const { error } = await admin.from("content_extraction_cache").upsert(
      {
        cache_key: options.cacheKey,
        source_kind: options.kind,
        source_url: options.sourceUrl,
        source_title: options.sourceTitle,
        source_text: options.sourceText,
        source_meta: options.sourceMeta,
        expires_at: expiresAt
      },
      { onConflict: "cache_key" }
    );

    if (error && !isMissingTableError(error)) {
      console.warn("Could not store extraction cache:", error);
    }
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.warn("Could not store extraction cache:", error);
    }
  }
}

export async function readPlatformGenerationCache(cacheKey: string) {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const raw = await redis.get(cacheKey);
    const parsed = parsePlatformGenerationRecord(raw);
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
