import { NextRequest, NextResponse } from "next/server";
import { fal } from "@/lib/fal";

async function resolveImageUrl(req: NextRequest): Promise<{ imageUrl?: string; prompt?: string; strength?: string }> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const prompt = String(formData.get("prompt") ?? "");
    const strength = String(formData.get("strength") ?? "medium");

    if (file) {
      const imageUrl = await fal.storage.upload(file);
      return { imageUrl, prompt, strength };
    }

    return {
      imageUrl: String(formData.get("imageUrl") ?? ""),
      prompt,
      strength,
    };
  }

  const body = await req.json();
  return {
    imageUrl: body.imageUrl as string | undefined,
    prompt: body.prompt as string | undefined,
    strength: body.strength as string | undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, prompt, strength } = await resolveImageUrl(req);

    const finalPrompt =
      prompt || "luxury hotel room, warm ambient lighting, elegant interior";

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl or file is required" }, { status: 400 });
    }

    const result = await fal.subscribe("fal-ai/image-editing/background-change", {
      input: {
        image_url: imageUrl,
        prompt: finalPrompt,
      },
      logs: true,
    });

    const outputUrl = result.data?.images?.[0]?.url ?? null;

    return NextResponse.json({
      success: true,
      requestId: result.requestId,
      uploadedImageUrl: imageUrl,
      strength: strength ?? "medium",
      imageUrl: outputUrl,
      data: result.data,
    });
  } catch (error) {
    console.error("background-change error:", error);
    return NextResponse.json({ error: "background-change failed" }, { status: 500 });
  }
}
