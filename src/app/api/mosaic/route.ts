import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const strength = Number(formData.get("strength") ?? 2);
    const area = String(formData.get("area") ?? "顔全体");

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const image = sharp(bytes);
    const meta = await image.metadata();

    const imgW = meta.width ?? 0;
    const imgH = meta.height ?? 0;

    if (!imgW || !imgH) {
      return NextResponse.json({ error: "invalid image" }, { status: 400 });
    }

    let left = Math.floor(imgW * 0.35);
    let top = Math.floor(imgH * 0.12);
    let w = Math.floor(imgW * 0.30);
    let h = Math.floor(imgH * 0.18);

    if (area === "目元のみ") {
      left = Math.floor(imgW * 0.38);
      top = Math.floor(imgH * 0.15);
      w = Math.floor(imgW * 0.24);
      h = Math.floor(imgH * 0.06);
    } else if (area === "口元のみ") {
      left = Math.floor(imgW * 0.42);
      top = Math.floor(imgH * 0.22);
      w = Math.floor(imgW * 0.16);
      h = Math.floor(imgH * 0.06);
    }

    const downW = Math.max(8, Math.floor(w / (strength * 5)));
    const downH = Math.max(8, Math.floor(h / (strength * 5)));

    const mosaicRegion = await sharp(bytes)
      .extract({ left, top, width: w, height: h })
      .resize(downW, downH, { kernel: "nearest" })
      .resize(w, h, { kernel: "nearest" })
      .png()
      .toBuffer();

    const output = await sharp(bytes)
      .composite([{ input: mosaicRegion, left, top }])
      .png()
      .toBuffer();

    return new NextResponse(new Uint8Array(output), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("mosaic error:", error);
    return NextResponse.json({ error: "mosaic failed" }, { status: 500 });
  }
}
