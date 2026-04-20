import { Readability } from "@mozilla/readability";
import dns from "node:dns/promises";
import net from "node:net";
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


const MAX_REDIRECTS = 5;

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;

  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a >= 224) return true;

  return false;
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd')
  );
}

function isBlockedIpAddress(address: string) {
  if (net.isIP(address) === 4) return isPrivateIpv4(address);
  if (net.isIP(address) === 6) return isPrivateIpv6(address);
  return true;
}

function isBlockedHostname(hostname: string) {
  const lower = hostname.trim().toLowerCase();
  return lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.local');
}

async function assertSafeHttpUrl(url: URL) {
  if (isBlockedHostname(url.hostname)) {
    throw new Error('That host is not allowed.');
  }

  if (net.isIP(url.hostname) && isBlockedIpAddress(url.hostname)) {
    throw new Error('That host is not allowed.');
  }

  const resolved = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (resolved.some((entry) => isBlockedIpAddress(entry.address))) {
    throw new Error('That host is not allowed.');
  }
}

async function fetchArticlePage(initialUrl: string, signal: AbortSignal) {
  let currentUrl = new URL(initialUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertSafeHttpUrl(currentUrl);

    const response = await fetch(currentUrl.toString(), {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; UserFirstAIContentRepurposer/2.0; +https://vercel.com)',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9'
      }
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error('That page redirected without a destination.');
      }

      currentUrl = new URL(location, currentUrl);
      if (currentUrl.protocol !== 'http:' && currentUrl.protocol !== 'https:') {
        throw new Error('Only http and https URLs are supported.');
      }

      continue;
    }

    return response;
  }

  throw new Error('That page redirected too many times.');
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
    response = await fetchArticlePage(url, controller.signal);
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