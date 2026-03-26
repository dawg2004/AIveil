"use client";

import { useMemo, useState } from "react";

type TabId = "mosaic" | "background-change" | "pose-change" | "image-to-video";

export default function Home() {
  const [tab, setTab] = useState<TabId>("mosaic");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [bgStrength, setBgStrength] = useState("medium");
  const [mosaicStrength, setMosaicStrength] = useState("2");
  const [mosaicArea, setMosaicArea] = useState("顔全体");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("待機中");
  const [resultUrl, setResultUrl] = useState("");
  const [log, setLog] = useState<string[]>([]);

  const falImageInput = imageUrl.trim();

  const tabs: { id: TabId; label: string }[] = [
    { id: "mosaic", label: "顔モザイク" },
    { id: "background-change", label: "背景変更" },
    { id: "pose-change", label: "ポーズ変更" },
    { id: "image-to-video", label: "画像→動画" },
  ];

  const payloadPreview = useMemo(() => {
    if (tab === "mosaic") {
      return JSON.stringify(
        {
          file: selectedFile?.name ?? null,
          strength: mosaicStrength,
          area: mosaicArea,
        },
        null,
        2
      );
    }

    if (tab === "background-change") {
      return JSON.stringify(
        {
          file: selectedFile?.name ?? null,
          imageUrl: falImageInput || null,
          prompt:
            prompt || "luxury hotel room, warm ambient lighting, elegant interior",
          strength: bgStrength,
        },
        null,
        2
      );
    }

    if (tab === "pose-change") {
      return JSON.stringify(
        {
          file: selectedFile?.name ?? null,
          imageUrl: falImageInput || null,
          prompt:
            prompt ||
            "Change only the pose to an elegant standing pose. Keep the same person, face, hairstyle, outfit, and background as consistent as possible.",
        },
        null,
        2
      );
    }

    return JSON.stringify(
      {
        file: selectedFile?.name ?? null,
        imageUrl: falImageInput || null,
        prompt: prompt || "subtle natural motion, cinematic, realistic",
        duration,
        aspectRatio,
      },
      null,
      2
    );
  }, [tab, selectedFile, mosaicStrength, mosaicArea, falImageInput, prompt, bgStrength, duration, aspectRatio]);

  const resetResult = () => {
    setResultUrl("");
    setLog([]);
    setStatus("待機中");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    resetResult();

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setStatus("画像選択済み");
    } else {
      setPreviewUrl("");
      setStatus("待機中");
    }
  };

  const runMosaic = async () => {
    if (!selectedFile) {
      alert("画像を選択してください");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("strength", mosaicStrength);
    formData.append("area", mosaicArea);

    setLoading(true);
    setStatus("モザイク処理中");
    setLog(["POST /api/mosaic"]);

    try {
      const res = await fetch("/api/mosaic", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "mosaic failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setStatus("完了");
      setLog((prev) => [...prev, "モザイク処理完了"]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "mosaic failed";
      console.error(error);
      setStatus("エラー");
      setLog((prev) => [...prev, message]);
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const runFalApi = async (endpoint: string, extra: Record<string, string | number>) => {
    if (!selectedFile && !falImageInput) {
      alert("画像を選択するか、元画像URLを入力してください");
      return;
    }

    setLoading(true);
    setStatus("API実行中");
    setLog([`POST ${endpoint}`]);

    try {
      let res: Response;

      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        Object.entries(extra).forEach(([key, value]) => {
          formData.append(key, String(value));
        });

        res = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageUrl: falImageInput,
            ...extra,
          }),
        });
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || JSON.stringify(data) || "request failed");
      }

      const outputUrl = data.imageUrl || data.videoUrl || "";
      setResultUrl(outputUrl);
      setStatus("完了");
      setLog((prev) => [
        ...prev,
        `requestId: ${data.requestId ?? "-"}`,
        data.uploadedImageUrl ? `uploaded: ${data.uploadedImageUrl}` : "uploaded: -",
        outputUrl ? `result: ${outputUrl}` : "resultなし",
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "request failed";
      console.error(error);
      setStatus("エラー");
      setLog((prev) => [...prev, message]);
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    resetResult();

    if (tab === "mosaic") {
      await runMosaic();
      return;
    }

    if (tab === "background-change") {
      await runFalApi("/api/background-change", {
        prompt: prompt || "luxury hotel room, warm ambient lighting, elegant interior",
        strength: bgStrength,
      });
      return;
    }

    if (tab === "pose-change") {
      await runFalApi("/api/pose-change", {
        prompt:
          prompt ||
          "Change only the pose to an elegant standing pose. Keep the same person, face, hairstyle, outfit, and background as consistent as possible.",
      });
      return;
    }

    await runFalApi("/api/image-to-video", {
      prompt: prompt || "subtle natural motion, cinematic, realistic",
      duration: Number(duration),
      aspectRatio,
    });
  };

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-7xl p-6 md:p-10">
        <div className="mb-8 rounded-3xl bg-gradient-to-br from-zinc-950 to-zinc-800 p-7 text-white shadow-xl">
          <div className="mb-3 inline-flex rounded-full border border-white/15 px-3 py-1 text-xs text-white/80">
            AIveil LAB
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            画像加工・動画化検証アプリ
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75 md:text-base">
            fal系もローカル画像選択で実行できるようにした版です。
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setTab(item.id);
                resetResult();
              }}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                tab === item.id
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 bg-white text-zinc-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                入力
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">画像選択</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="block w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm"
                  />
                  <div className="mt-2 text-sm text-zinc-500">
                    {selectedFile ? `選択中: ${selectedFile.name}` : "未選択"}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">元画像URL</label>
                  <input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/source.jpg"
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                  />
                  <div className="mt-2 text-xs text-zinc-500">
                    URL未入力でも、画像選択済みなら fal 系 API を実行します
                  </div>
                </div>

                {tab !== "mosaic" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium">プロンプト</label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={
                        tab === "background-change"
                          ? "例: luxury hotel room, warm ambient lighting, elegant interior"
                          : tab === "pose-change"
                          ? "例: Change only the pose to a seated pose. Keep the same person, face, hairstyle, outfit, and background as consistent as possible."
                          : "例: subtle natural motion, cinematic, realistic"
                      }
                      className="min-h-32 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                    />
                  </div>
                )}

                {tab === "mosaic" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium">モザイク強度</label>
                      <select
                        value={mosaicStrength}
                        onChange={(e) => setMosaicStrength(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                      >
                        <option value="1">弱</option>
                        <option value="2">中</option>
                        <option value="3">強</option>
                        <option value="4">最強</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium">対象範囲</label>
                      <select
                        value={mosaicArea}
                        onChange={(e) => setMosaicArea(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                      >
                        <option>顔全体</option>
                        <option>目元のみ</option>
                        <option>口元のみ</option>
                      </select>
                    </div>
                  </div>
                )}

                {tab === "background-change" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium">変更強度</label>
                    <div className="flex gap-2">
                      {["low", "medium", "high"].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setBgStrength(value)}
                          className={`rounded-xl px-4 py-2 text-sm font-medium ${
                            bgStrength === value
                              ? "bg-zinc-900 text-white"
                              : "border border-zinc-200 bg-white text-zinc-700"
                          }`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {tab === "image-to-video" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium">秒数</label>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                      >
                        <option>5</option>
                        <option>8</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium">縦横比</label>
                      <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                      >
                        <option>9:16</option>
                        <option>16:9</option>
                        <option>1:1</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleRun}
                    disabled={loading}
                    className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:bg-zinc-400"
                  >
                    {loading ? "実行中" : "実行"}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Payload preview
              </div>
              <pre className="overflow-x-auto rounded-2xl bg-zinc-950 p-4 text-xs leading-6 text-zinc-300">
                {payloadPreview}
              </pre>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                    プレビュー
                  </div>
                  <h2 className="mt-1 text-xl font-semibold">結果確認</h2>
                </div>
                <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                  {status}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="input"
                      className="aspect-[3/4] w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-[3/4] w-full bg-[linear-gradient(135deg,#d4d4d8,#f4f4f5)]" />
                  )}
                  <div className="border-t border-zinc-200 px-4 py-3 text-sm text-zinc-600">
                    input
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
                  {resultUrl ? (
                    tab === "image-to-video" ? (
                      <video
                        src={resultUrl}
                        controls
                        className="aspect-video w-full bg-black object-contain"
                      />
                    ) : (
                      <img
                        src={resultUrl}
                        alt="output"
                        className="aspect-[3/4] w-full object-cover"
                      />
                    )
                  ) : (
                    <div
                      className={`w-full ${
                        tab === "image-to-video"
                          ? "aspect-video bg-[radial-gradient(circle_at_top_left,#d4d4d8,transparent_35%),linear-gradient(135deg,#18181b,#3f3f46)]"
                          : "aspect-[3/4] bg-[linear-gradient(135deg,#e4d4b7,#faf7f0)]"
                      }`}
                    />
                  )}
                  <div className="border-t border-zinc-200 px-4 py-3 text-sm text-zinc-600">
                    output
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Log
              </div>
              <div className="space-y-3">
                {log.length === 0 ? (
                  <div className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                    まだ実行していません
                  </div>
                ) : (
                  log.map((item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700"
                    >
                      {item}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
