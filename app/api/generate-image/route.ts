import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateImageFromPrompt } from "@/lib/cloudflare-image";
import { assertTrustedOrigin, jsonNoStore } from "@/lib/http-security";
import { getViewerContext } from "@/lib/viewer";
import { logActivity } from "@/lib/activity";

const bodySchema = z.object({
  prompt: z.string().trim().min(1, "Prompt is required."),
  aspectRatio: z.enum(["1:1", "3:4", "4:3", "9:16", "16:9"]).optional()
});

export async function POST(request: Request) {
  const trustedOrigin = assertTrustedOrigin(request);
  if (!trustedOrigin.ok) {
    return trustedOrigin.response;
  }

  const viewer = await getViewerContext();

  if (!viewer) {
    return jsonNoStore({ error: "Unauthorized." }, { status: 401 });
  }

  if (
    viewer.imageMonthlyLimit !== null &&
    viewer.imageUsedThisMonth >= viewer.imageMonthlyLimit
  ) {
    return jsonNoStore(
      {
        error:
          viewer.tier === "free"
            ? "You have already used your 1 image for this month on Free. Upgrade for more images."
            : "You have reached your monthly image limit for Plus. Upgrade to Pro for unlimited images.",
        usage: {
          tier: viewer.tier,
          imageUsedThisMonth: viewer.imageUsedThisMonth,
          imageMonthlyLimit: viewer.imageMonthlyLimit,
          imageRemainingThisMonth: 0,
          usageWindowLabel: viewer.usageWindowLabel
        }
      },
      { status: 403 }
    );
  }

  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      return jsonNoStore(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 }
      );
    }

    const result = await generateImageFromPrompt({
      prompt: parsed.data.prompt,
      aspectRatio: parsed.data.aspectRatio
    });

    const supabase = await createClient();
    const { error: insertError } = await supabase.from("image_generations").insert({
      user_id: viewer.userId,
      prompt: parsed.data.prompt,
      aspect_ratio: parsed.data.aspectRatio ?? "1:1",
      model_name: result.model
    });

    if (!insertError) {
      revalidatePath("/dashboard");
      revalidatePath("/profile");

      await logActivity({
        actorUserId: viewer.userId,
        action: "image_generation_success",
        metadata: {
          aspectRatio: parsed.data.aspectRatio ?? "1:1",
          model: result.model
        }
      });
    }

    const imageUsedThisMonth = insertError
      ? viewer.imageUsedThisMonth
      : viewer.imageUsedThisMonth + 1;
    const imageRemainingThisMonth =
      viewer.imageMonthlyLimit === null
        ? null
        : Math.max(viewer.imageMonthlyLimit - imageUsedThisMonth, 0);

    return jsonNoStore({
      imageDataUrl: result.dataUrl,
      model: result.model,
      usage: {
        tier: viewer.tier,
        imageUsedThisMonth,
        imageMonthlyLimit: viewer.imageMonthlyLimit,
        imageRemainingThisMonth,
        usageWindowLabel: viewer.usageWindowLabel
      },
      warning: insertError ? "Image generated, but usage could not be saved." : null
    });
  } catch (error) {
    console.error("generate-image route failed:", error);
    return jsonNoStore(
      {
        error:
          error instanceof Error
            ? error.message
            : "Image generation failed."
      },
      { status: 500 }
    );
  }
}
