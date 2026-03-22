import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { countWords, limitCharacters, sanitizeSourceText } from "@/lib/utils";

type ExtractedArticle = {
  url: string;
  title: string;
  text: string;
};

const MIN_EXTRACTED_WORDS = 120;
const MAX_SOURCE_CHARACTERS = 24000;

function validateHttpUrl(value: string) {
  const url = new URL(value);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported.");
  }

  return url.toString();
}

function getBestTitle(document: Document, url: string) {
  const candidates = [
    document.querySelector("meta[property='og:title']")?.getAttribute("content"),
    document.querySelector("meta[name='twitter:title']")?.getAttribute("content"),
    document.querySelector("h1")?.textContent,
    document.title,
    new URL(url).hostname
  ]
    .map((value) => sanitizeSourceText(value ?? ""))
    .filter(Boolean);

  return candidates[0] ?? new URL(url).hostname;
}

function getFallbackReadableText(document: Document) {
  const selectors = [
    "article",
    "main",
    "[role='main']",
    ".post-content",
    ".entry-content",
    ".article-content",
    ".content",
    "#content",
    ".post-body",
    ".story-body",
    ".main-content"
  ];

  const candidateTexts = selectors
    .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
    .map((node) => sanitizeSourceText(node.textContent ?? ""))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const bodyText = sanitizeSourceText(document.body?.textContent ?? "");

  return candidateTexts[0] && candidateTexts[0].length > bodyText.length * 0.25
    ? candidateTexts[0]
    : bodyText;
}

function looksBlockedOrJsOnly(html: string) {
  const lower = html.toLowerCase();
  return (
    lower.includes("enable javascript") ||
    lower.includes("access denied") ||
    lower.includes("just a moment") ||
    lower.includes("captcha") ||
    lower.includes("cloudflare")
  );
}

export async function extractArticleFromUrl(rawUrl: string): Promise<ExtractedArticle> {
  const url = validateHttpUrl(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; UserFirstAIContentRepurposer/2.0; +https://vercel.com)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9"
      }
    });
  } catch (error) {
    clearTimeout(timeout);

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("That page took too long to respond.");
    }

    throw new Error("Could not fetch that URL.");
  }

  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(`Could not fetch that page (HTTP ${response.status}).`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    throw new Error("That URL did not return a normal HTML page.");
  }

  const html = await response.text();
  if (!html.trim()) {
    throw new Error("That page returned empty HTML.");
  }

  const dom = new JSDOM(html, {
    url: response.url
  });

  dom.window.document
    .querySelectorAll("script, style, noscript, iframe, svg, canvas, form")
    .forEach((node) => node.remove());

  const readabilityResult = new Readability(dom.window.document).parse();

  const title = getBestTitle(dom.window.document, response.url);

  const text = limitCharacters(
    sanitizeSourceText(
      readabilityResult?.textContent ?? getFallbackReadableText(dom.window.document)
    ),
    MAX_SOURCE_CHARACTERS
  );

  if (!text || countWords(text) < MIN_EXTRACTED_WORDS) {
    if (looksBlockedOrJsOnly(html)) {
      throw new Error(
        "That website blocks simple server-side extraction or relies too heavily on client-side rendering. Paste the text manually instead."
      );
    }

    throw new Error(
      "I could not extract enough clean article text from that URL. Try another article or paste the text manually."
    );
  }

  return {
    url: response.url,
    title,
    text
  };
}