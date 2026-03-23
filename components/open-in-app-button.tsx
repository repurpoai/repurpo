"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type ContentPlatform } from "@/lib/plans";

type OpenInAppButtonProps = {
  platform: ContentPlatform;
  text: string;
  sourceTitle?: string;
  imageUrl?: string | null;
};

function getOpenUrl(platform: ContentPlatform, text: string, sourceTitle?: string) {
  const encodedText = encodeURIComponent(text);
  const encodedTitle = encodeURIComponent(sourceTitle?.trim() || "Post");

  switch (platform) {
    case "x":
      return `https://twitter.com/intent/tweet?text=${encodedText}`;
    case "linkedin":
      return "https://www.linkedin.com/feed/";
    case "instagram":
      return "https://www.instagram.com/";
    case "reddit":
      return `https://www.reddit.com/submit?selftext=true&title=${encodedTitle}&text=${encodedText}`;
    default:
      return null;
  }
}

function getButtonLabel(platform: ContentPlatform) {
  switch (platform) {
    case "x":
      return "Open in X";
    case "linkedin":
      return "Open in LinkedIn";
    case "instagram":
      return "Open in Instagram";
    case "reddit":
      return "Open in Reddit";
    default:
      return "Open";
  }
}

async function downloadImage(imageUrl: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = imageUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function OpenInAppButton({
  platform,
  text,
  sourceTitle,
  imageUrl
}: OpenInAppButtonProps) {
  const [opening, setOpening] = useState(false);

  const openUrl = getOpenUrl(platform, text, sourceTitle);

  if (!openUrl) {
    return null;
  }

  async function handleClick() {
    try {
      setOpening(true);

      await navigator.clipboard.writeText(text);

      if (imageUrl) {
        await downloadImage(imageUrl, `${platform}-image.png`);
      }

      window.open(openUrl, "_blank", "noopener,noreferrer");
    } finally {
      setOpening(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={opening}>
      <ExternalLink className="h-4 w-4" />
      {opening ? "Opening..." : getButtonLabel(platform)}
    </Button>
  );
}
