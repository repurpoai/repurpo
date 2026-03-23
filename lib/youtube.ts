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

function normalizeYouTubeUrl(rawUrl: string) {
  const url = new URL(rawUrl);

  const hostname = url.hostname.replace(/^www\./, "");
  const isYouTube =
    hostname === "youtube.com" ||
    hostname === "m.youtube.com" ||
    hostname === "youtu.be";

  if (!isYouTube) {
    throw new Error("Enter a valid YouTube URL.");
  }

  return url.toString();
}

function getYouTubeVideoId(rawUrl: string) {
  const url = new URL(rawUrl);
  const hostname = url.hostname.replace(/^www\./, "");

  if (hostname === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    if (!id) throw new Error("Could not detect the YouTube video ID.");
    return id;
  }

  const directId = url.searchParams.get("v");
  if (directId) return directId;

  const parts = url.pathname.split("/").filter(Boolean);
  const shortsIndex = parts.findIndex((part) => part === "shorts");
  if (shortsIndex !== -1 && parts[shortsIndex + 1]) {
    return parts[shortsIndex + 1];
  }

  throw new Error("Could not detect the YouTube video ID.");
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

export async function extractYouTubeTranscript(rawUrl: string): Promise<YouTubeExtraction> {
  const url = normalizeYouTubeUrl(rawUrl);
  const videoId = getYouTubeVideoId(url);

  let transcriptItems: Array<{ text?: string }> = [];

  try {
    transcriptItems = (await fetchTranscript(videoId)) as Array<{ text?: string }>;
  } catch {
    throw new Error(
      "I could not fetch a transcript for that YouTube video. Try another video or paste the text manually."
    );
  }

  const transcriptText = limitCharacters(
    sanitizeSourceText(
      transcriptItems
        .map((item) => item.text ?? "")
        .filter(Boolean)
        .join(" ")
    ),
    MAX_SOURCE_CHARACTERS
  );

  if (!transcriptText || countWords(transcriptText) < MIN_TRANSCRIPT_WORDS) {
    throw new Error(
      "That YouTube video does not have enough transcript text to repurpose."
    );
  }

  const oembed = await getYouTubeOembed(url);

  return {
    url,
    title: oembed.title || "YouTube video",
    text: transcriptText,
    sourceMeta: {
      kind: "youtube",
      videoId,
      channelName: oembed.author_name
    }
  };
}