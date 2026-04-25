import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRedisClient } from "@/lib/upstash";

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

export function makeExtractionCacheKey(kind: ExtractionCacheKind, value: string) {
  const normalized = value.trim().toLowerCase();
  const hash = crypto.createHash("sha256").update(normalized).digest("hex");
  return `${kind}:${hash}`;
}

function parseSourceMeta(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as Record<string, unknown>;
}

function parseRedisPayload(raw: unknown): RedisExtractionCachePayload | null {
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

function isMissingTableError(error: unknown) {
  const record = error as {
    code?: string;
    message?: string;
    details?: string;
  } | null;

  const haystack = `${record?.code ?? ""} ${record?.message ?? ""} ${record?.details ?? ""}`.toLowerCase();

  return (
    record?.code === "42P01" ||
    haystack.includes('relation "public.content_extraction_cache" does not exist') ||
    haystack.includes('relation "content_extraction_cache" does not exist') ||
    haystack.includes("could not find the table")
  );
}

async function readFromRedis(cacheKey: string): Promise<CachedExtraction | null> {
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  try {
    const raw = await redis.get(cacheKey);
    const parsed = parseRedisPayload(raw);
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

async function writeToRedis(options: {
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

    await redis.set(options.cacheKey, JSON.stringify(payload), {
      ex: ttlSeconds
    });

    return true;
  } catch (error) {
    console.warn("Could not store extraction cache in Upstash Redis:", error);
    return false;
  }
}

export async function readExtractionCache(
  cacheKey: string,
  kind: ExtractionCacheKind
): Promise<CachedExtraction | null> {
  const redisHit = await readFromRedis(cacheKey);
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
  const redisStored = await writeToRedis({
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
