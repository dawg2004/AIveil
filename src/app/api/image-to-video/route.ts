import { NextRequest, NextResponse } from "next/server";
import { fal } from "@/lib/fal";

async function resolveInput(req: NextRequest): Promise<{
  imageUrl?: string;
  prompt?: string;
  duration?: number;
  aspectRatio?: string;
}> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const prompt = String(formData.get("prompt") ?? "");
    const duration = Number(formData.get("duration") ?? 5);
    const aspectRatio = String(formData.get("aspectRatio") ?? "9:16");

    if (file) {
      const imageUrl = await fal.storage.upload(file);
      return { imageUrl, prompt, duration, aspectRatio };
    }

    return {
      imageUrl: String(formData.get("imageUrl") ?? ""),
      prompt,
      duration,
      aspectRatio,
    };
  }

  const body = await req.json();
  return {
    imageUrl: body.imageUrl as string | undefined,
    prompt: body.prompt as string | undefined,
    duration: Number(body.duration ?? 5),
    aspectRatio: body.aspectRatio as string | undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, prompt, duration, aspectRatio } = await resolveInput(req);

    const finalPrompt = prompt || "subtle natural motion, cinematic, realistic";
    const finalDuration = Number(duration ?? 5);
    const finalAspectRatio = aspectRatio || "9:16";

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl or file is required" }, { status: 400 });
    }

    const result = await fal.subscribe("xai/grok-imagine-video/image-to-video", {
      input: {
        image_url: imageUrl,
        prompt: finalPrompt,
        duration: finalDuration,
        aspect_ratio: finalAspectRatio,
      },
      logs: true,
    });

    const videoUrl =
      result.data?.video?.url ??
      result.data?.videos?.[0]?.url ??
      null;

    return NextResponse.json({
      success: true,
      requestId: result.requestId,
      uploadedImageUrl: imageUrl,
      videoUrl,
      data: result.data,
    });
  } catch (error) {
    console.error("image-to-video error:", error);
    return NextResponse.json({ error: "image-to-video failed" }, { status: 500 });
  }
}
