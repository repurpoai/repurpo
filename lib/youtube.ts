import { fetchTranscript } from "youtube-transcript";
import { countWords, limitCharacters, sanitizeSourceText } from "@/lib/utils";
import { makeExtractionCacheKey, readExtractionCache, storeExtractionCache } from "@/lib/content-cache";

type YouTubeExtraction = {
  url: string;
  title: string;
  text: string;
  sourceMeta: {
    kind: "youtube";
    videoId: string;
    channelName: string | null;
  };
};

type TranscriptChunk = {
  text?: string;
  snippet?: string;
  offset?: number;
  duration?: number;
  start_ms?: number;
  end_ms?: number;
};

const MAX_SOURCE_CHARACTERS = 24000;
const MIN_TRANSCRIPT_WORDS = 120;
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const SUPADATA_BASE_URL = process.env.SUPADATA_BASE_URL?.trim() || "https://api.supadata.ai/v1";
const SUPADATA_API_KEY = process.env.SUPADATA_API_KEY?.trim() || "";
const SERPAPI_BASE_URL = process.env.SERPAPI_BASE_URL?.trim() || "https://serpapi.com/search.json";
const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY?.trim() || "";

class ProviderError extends Error {
  provider: string;
  status?: number;

  constructor(provider: string, message: string, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.status = status;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(input: string, init?: RequestInit, timeoutMs = 12000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {})
      }
    });

    const text = await response.text();
    let data: unknown = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    return {
      response,
      data
    } as T;
  } finally {
    clearTimeout(timer);
  }
}

function parseYouTubeUrl(rawUrl: string) {
  let url: URL;

  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Enter a valid YouTube URL.");
  }

  const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
  const supportedHosts = new Set([
    "youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be"
  ]);

  if (!supportedHosts.has(hostname)) {
    throw new Error("Enter a valid YouTube URL.");
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  const searchVideoId = url.searchParams.get("v")?.trim() ?? "";

  let videoId = "";

  if (hostname === "youtu.be") {
    videoId = pathParts[0] ?? "";
  } else if (YOUTUBE_ID_PATTERN.test(searchVideoId)) {
    videoId = searchVideoId;
  } else {
    const markerIndex = pathParts.findIndex((part) =>
      ["shorts", "live", "embed", "v"].includes(part)
    );

    if (markerIndex !== -1) {
      videoId = pathParts[markerIndex + 1] ?? "";
    }
  }

  if (!YOUTUBE_ID_PATTERN.test(videoId)) {
    throw new Error(
      "Could not detect the YouTube video ID. Try a normal watch link, share link, Shorts link, or embed link."
    );
  }

  const canonicalUrl = new URL(`https://www.youtube.com/watch?v=${videoId}`);
  const startTime = url.searchParams.get("t") ?? url.searchParams.get("start");
  if (startTime) {
    canonicalUrl.searchParams.set("t", startTime);
  }

  return {
    url: canonicalUrl.toString(),
    videoId,
    isLikelyLive: pathParts.includes("live") || pathParts.includes("streams")
  };
}

async function getYouTubeOembed(url: string) {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return {
        title: "YouTube video",
        author_name: null as string | null
      };
    }

    const data = (await response.json()) as {
      title?: string;
      author_name?: string;
    };

    return {
      title: sanitizeSourceText(data.title ?? "YouTube video"),
      author_name: sanitizeSourceText(data.author_name ?? "")
        ? sanitizeSourceText(data.author_name ?? "")
        : null
    };
  } catch {
    return {
      title: "YouTube video",
      author_name: null as string | null
    };
  }
}

function collapseTranscript(items: Array<TranscriptChunk>) {
  return limitCharacters(
    sanitizeSourceText(
      items
        .map((item) => item.text ?? item.snippet ?? "")
        .filter(Boolean)
        .join(" ")
    ),
    MAX_SOURCE_CHARACTERS
  );
}

function collapseTranscriptText(text: string) {
  return limitCharacters(sanitizeSourceText(text), MAX_SOURCE_CHARACTERS);
}

function hasUsableTranscript(text: string) {
  return Boolean(text) && countWords(text) >= MIN_TRANSCRIPT_WORDS;
}

function getJobId(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const jobId = record.jobId ?? record.job_id ?? record.id;
  return typeof jobId === "string" && jobId ? jobId : null;
}

async function fetchSupadataTranscript(url: string): Promise<string> {
  if (!SUPADATA_API_KEY) {
    throw new ProviderError("supadata", "Supadata API key missing.");
  }

  const endpoint = new URL(`${SUPADATA_BASE_URL.replace(/\/$/, "")}/transcript`);
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("lang", "en");
  endpoint.searchParams.set("text", "true");
  endpoint.searchParams.set("mode", "native");

  const { response, data } = await fetchJson<{ response: Response; data: unknown }>(endpoint.toString(), {
    headers: {
      "x-api-key": SUPADATA_API_KEY
    }
  });

  if (response.status === 202) {
    const jobId = getJobId(data);
    if (!jobId) {
      throw new ProviderError("supadata", "Supadata returned an async job without a job ID.", 202);
    }

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await sleep(1200);

      const pollUrl = `${SUPADATA_BASE_URL.replace(/\/$/, "")}/transcript/${encodeURIComponent(jobId)}`;
      const polled = await fetchJson<{ response: Response; data: unknown }>(pollUrl, {
        headers: {
          "x-api-key": SUPADATA_API_KEY
        }
      });

      if (polled.response.ok) {
        const payload = polled.data as Record<string, unknown> | null;
        const content = payload?.content;

        if (typeof content === "string") {
          const transcriptText = collapseTranscriptText(content);
          if (hasUsableTranscript(transcriptText)) return transcriptText;
        }

        if (Array.isArray(content)) {
          const transcriptText = collapseTranscript(content as TranscriptChunk[]);
          if (hasUsableTranscript(transcriptText)) return transcriptText;
        }
      }
    }

    throw new ProviderError("supadata", "Supadata transcript job did not complete in time.", 202);
  }

  if (!response.ok) {
    throw new ProviderError(
      "supadata",
      `Supadata transcript request failed with status ${response.status}.`,
      response.status
    );
  }

  const payload = data as Record<string, unknown> | null;
  const content = payload?.content;

  if (typeof content === "string") {
    const transcriptText = collapseTranscriptText(content);
    if (transcriptText) return transcriptText;
  }

  if (Array.isArray(content)) {
    const transcriptText = collapseTranscript(content as TranscriptChunk[]);
    if (transcriptText) return transcriptText;
  }

  throw new ProviderError("supadata", "Supadata returned no usable transcript.", response.status);
}

async function fetchSerpApiTranscript(videoId: string): Promise<string> {
  if (!SERPAPI_API_KEY) {
    throw new ProviderError("serpapi", "SerpApi key missing.");
  }

  const buildUrl = (languageCode?: string) => {
    const url = new URL(SERPAPI_BASE_URL);
    url.searchParams.set("engine", "youtube_video_transcript");
    url.searchParams.set("v", videoId);
    url.searchParams.set("api_key", SERPAPI_API_KEY);
    url.searchParams.set("no_cache", "false");
    if (languageCode) url.searchParams.set("language_code", languageCode);
    return url.toString();
  };

  const attempts = [buildUrl("en"), buildUrl()];
  let lastError: ProviderError | null = null;

  for (const attemptUrl of attempts) {
    try {
      const { response, data } = await fetchJson<{ response: Response; data: unknown }>(attemptUrl);

      if (!response.ok) {
        throw new ProviderError(
          "serpapi",
          `SerpApi transcript request failed with status ${response.status}.`,
          response.status
        );
      }

      const payload = data as Record<string, unknown> | null;
      if (typeof payload?.error === "string" && payload.error) {
        throw new ProviderError("serpapi", payload.error, response.status);
      }

      const transcript = payload?.transcript;
      if (Array.isArray(transcript)) {
        const transcriptText = collapseTranscript(transcript as TranscriptChunk[]);
        if (transcriptText) {
          return transcriptText;
        }
      }
    } catch (error) {
      lastError = error instanceof ProviderError
        ? error
        : new ProviderError("serpapi", error instanceof Error ? error.message : "SerpApi failed.");
    }
  }

  throw lastError ?? new ProviderError("serpapi", "SerpApi returned no usable transcript.");
}

async function fetchTranscriptWithFallbacks(videoId: string, url: string) {
  const failures: ProviderError[] = [];

  try {
    return await fetchSupadataTranscript(url);
  } catch (error) {
    failures.push(
      error instanceof ProviderError
        ? error
        : new ProviderError("supadata", error instanceof Error ? error.message : "Supadata failed.")
    );
  }

  try {
    return await fetchSerpApiTranscript(videoId);
  } catch (error) {
    failures.push(
      error instanceof ProviderError
        ? error
        : new ProviderError("serpapi", error instanceof Error ? error.message : "SerpApi failed.")
    );
  }

  const transcriptClient = fetchTranscript as unknown as (
    target: string,
    options?: { lang?: string }
  ) => Promise<Array<{ text?: string }>>;

  const youtubeAttempts: Array<() => Promise<Array<{ text?: string }>>> = [
    () => transcriptClient(videoId),
    () => transcriptClient(url),
    () => transcriptClient(videoId, { lang: "en" }),
    () => transcriptClient(url, { lang: "en" })
  ];

  let lastYoutubeError: unknown = null;

  for (const attempt of youtubeAttempts) {
    try {
      const result = await attempt();
      if (Array.isArray(result) && result.length > 0) {
        const transcriptText = collapseTranscript(result);
        if (transcriptText) {
          return transcriptText;
        }
      }
    } catch (error) {
      lastYoutubeError = error;
    }
  }

  if (failures.length) {
    console.warn(
      "YouTube transcript fallbacks failed before direct fetch succeeded:",
      failures.map((failure) => ({ provider: failure.provider, status: failure.status, message: failure.message }))
    );
  }

  throw lastYoutubeError instanceof Error ? lastYoutubeError : new Error("Transcript fetch failed.");
}

export async function extractYouTubeTranscript(rawUrl: string): Promise<YouTubeExtraction> {
  const parsed = parseYouTubeUrl(rawUrl);
  const cacheKey = makeExtractionCacheKey("youtube", parsed.videoId);

  const cached = await readExtractionCache(cacheKey, "youtube");
  if (cached) {
    return {
      url: cached.url,
      title: cached.title,
      text: cached.text,
      sourceMeta: {
        kind: "youtube",
        videoId: parsed.videoId,
        channelName:
          typeof cached.sourceMeta.channelName === "string" ? cached.sourceMeta.channelName : null
      }
    };
  }

  let transcriptText = "";

  try {
    transcriptText = await fetchTranscriptWithFallbacks(parsed.videoId, parsed.url);
  } catch {
    throw new Error(
      parsed.isLikelyLive
        ? "This looks like a live or recently streamed YouTube link. Transcript access is unreliable for live videos here. Try a normal watch URL after captions are fully processed, or paste text manually."
        : "This video may show captions on YouTube, but the app could not access the transcript. Try another video or paste the transcript manually."
    );
  }

  if (!transcriptText || countWords(transcriptText) < MIN_TRANSCRIPT_WORDS) {
    throw new Error(
      "A transcript was found, but it was too short to repurpose well. Try a longer video or paste more source text manually."
    );
  }

  const oembed = await getYouTubeOembed(parsed.url);

  void storeExtractionCache({
    cacheKey,
    kind: "youtube",
    sourceUrl: parsed.url,
    sourceTitle: oembed.title || "YouTube video",
    sourceText: transcriptText,
    sourceMeta: {
      kind: "youtube",
      videoId: parsed.videoId,
      channelName: oembed.author_name
    },
    ttlSeconds: 24 * 60 * 60
  });

  return {
    url: parsed.url,
    title: oembed.title || "YouTube video",
    text: transcriptText,
    sourceMeta: {
      kind: "youtube",
      videoId: parsed.videoId,
      channelName: oembed.author_name
    }
  };
}
