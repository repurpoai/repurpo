const DEFAULT_CLOUDFLARE_IMAGE_MODEL =
  process.env.CLOUDFLARE_AI_IMAGE_MODEL?.trim() ||
  "@cf/stabilityai/stable-diffusion-xl-base-1.0";

type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

type GenerateCloudflareImageInput = {
  prompt: string;
  aspectRatio?: AspectRatio;
};

type GenerateCloudflareImageResult = {
  dataUrl: string;
  model: string;
};

function getCloudflareConfig() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

  if (!accountId || !apiToken) {
    throw new Error(
      "Missing Cloudflare image settings. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN."
    );
  }

  return {
    accountId,
    apiToken,
    model: DEFAULT_CLOUDFLARE_IMAGE_MODEL
  };
}

function getDimensions(aspectRatio: AspectRatio = "1:1") {
  switch (aspectRatio) {
    case "3:4":
      return { width: 960, height: 1280 };
    case "4:3":
      return { width: 1280, height: 960 };
    case "9:16":
      return { width: 1024, height: 1792 };
    case "16:9":
      return { width: 1792, height: 1024 };
    case "1:1":
    default:
      return { width: 1024, height: 1024 };
  }
}

async function parseCloudflareError(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as {
        errors?: Array<{ message?: string }>;
        result?: { response?: string };
      };

      const message =
        payload.errors?.[0]?.message ||
        payload.result?.response ||
        "Cloudflare image generation failed.";

      return message;
    } catch {
      return "Cloudflare image generation failed.";
    }
  }

  try {
    const text = (await response.text()).trim();
    return text || "Cloudflare image generation failed.";
  } catch {
    return "Cloudflare image generation failed.";
  }
}

export async function generateImageFromPrompt({
  prompt,
  aspectRatio = "1:1"
}: GenerateCloudflareImageInput): Promise<GenerateCloudflareImageResult> {
  const { accountId, apiToken, model } = getCloudflareConfig();
  const { width, height } = getDimensions(aspectRatio);

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt,
        width,
        height,
        num_steps: 10,
        guidance: 7.5,
        negative_prompt:
          "blurry, distorted, deformed, low quality, extra fingers, extra limbs, watermark, logo, text overlay, UI, screenshot"
      }),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(await parseCloudflareError(response));
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const bytes = await response.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");

  return {
    dataUrl: `data:${contentType};base64,${base64}`,
    model
  };
}
