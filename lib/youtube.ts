import { fetchTranscript } from "youtube-transcript";
import { countWords, limitCharacters, sanitizeSourceText } from "@/lib/utils";

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

const MAX_SOURCE_CHARACTERS = 24000;
const MIN_TRANSCRIPT_WORDS = 120;
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

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

function collapseTranscript(items: Array<{ text?: string }>) {
  return limitCharacters(
    sanitizeSourceText(
      items
        .map((item) => item.text ?? "")
        .filter(Boolean)
        .join(" ")
    ),
    MAX_SOURCE_CHARACTERS
  );
}

async function fetchTranscriptWithFallbacks(videoId: string, url: string) {
  const transcriptClient = fetchTranscript as unknown as (
    target: string,
    options?: { lang?: string }
  ) => Promise<Array<{ text?: string }>>;

  const attempts: Array<() => Promise<Array<{ text?: string }>>> = [
    () => transcriptClient(videoId),
    () => transcriptClient(url),
    () => transcriptClient(videoId, { lang: "en" }),
    () => transcriptClient(url, { lang: "en" })
  ];

  let lastError: unknown = null;

  for (const attempt of attempts) {
    try {
      const result = await attempt();
      if (Array.isArray(result) && result.length > 0) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Transcript fetch failed.");
}

export async function extractYouTubeTranscript(rawUrl: string): Promise<YouTubeExtraction> {
  const parsed = parseYouTubeUrl(rawUrl);

  let transcriptItems: Array<{ text?: string }> = [];

  try {
    transcriptItems = await fetchTranscriptWithFallbacks(parsed.videoId, parsed.url);
  } catch {
    throw new Error(
      parsed.isLikelyLive
        ? "This looks like a live or recently streamed YouTube link. Transcript access is unreliable for live videos here. Try a normal watch URL after captions are fully processed, or paste text manually."
        : "This video may show captions on YouTube, but the app could not access the transcript. Try a standard watch URL, another video, or paste the transcript manually."
    );
  }

  const transcriptText = collapseTranscript(transcriptItems);

  if (!transcriptText || countWords(transcriptText) < MIN_TRANSCRIPT_WORDS) {
    throw new Error(
      "A transcript was found, but it was too short to repurpose well. Try a longer video or paste more source text manually."
    );
  }

  const oembed = await getYouTubeOembed(parsed.url);

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
