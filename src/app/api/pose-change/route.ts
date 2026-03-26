import { NextRequest, NextResponse } from "next/server";
import { fal } from "@/lib/fal";

async function resolveImageUrl(req: NextRequest): Promise<{ imageUrl?: string; prompt?: string }> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const prompt = String(formData.get("prompt") ?? "");

    if (file) {
      const imageUrl = await fal.storage.upload(file);
      return { imageUrl, prompt };
    }

    return {
      imageUrl: String(formData.get("imageUrl") ?? ""),
      prompt,
    };
  }

  const body = await req.json();
  return {
    imageUrl: body.imageUrl as string | undefined,
    prompt: body.prompt as string | undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, prompt } = await resolveImageUrl(req);

    const finalPrompt =
      prompt ||
      "Change only the pose to an elegant standing pose. Keep the same person, face, hairstyle, outfit, and background as consistent as possible.";

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl or file is required" }, { status: 400 });
    }

    const result = await fal.subscribe("xai/grok-imagine-image/edit", {
      input: {
        prompt: finalPrompt,
        image_urls: [imageUrl],
      },
      logs: true,
    });

    const outputUrl = result.data?.images?.[0]?.url ?? null;

    return NextResponse.json({
      success: true,
      requestId: result.requestId,
      uploadedImageUrl: imageUrl,
      imageUrl: outputUrl,
      data: result.data,
    });
  } catch (error) {
    console.error("pose-change error:", error);
    return NextResponse.json({ error: "pose-change failed" }, { status: 500 });
  }
}
