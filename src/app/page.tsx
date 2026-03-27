"use client";

import { useMemo, useRef, useState } from "react";
import { detectFirstFace } from "@/lib/faceDetector";

type TabId = "mosaic" | "background-change" | "pose-change" | "image-to-video";

export default function Home() {
  const [tab, setTab] = useState<TabId>("image-to-video");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [bgStrength, setBgStrength] = useState("medium");
  const [mosaicStrength, setMosaicStrength] = useState("2");
  const [mosaicArea, setMosaicArea] = useState("顔全体");
  const [mosaicMode, setMosaicMode] = useState("モザイク");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("待機中");
  const [resultUrl, setResultUrl] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("待機中");
  const progressTimerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const tabs: { id: TabId; label: string }[] = [
    { id: "image-to-video", label: "画像→動画" },
  ];

  const payloadPreview = useMemo(() => {
    if (tab === "mosaic") {
      return JSON.stringify(
        {
          file: selectedFile?.name ?? null,
          strength: mosaicStrength,
          area: mosaicArea,
          mode: mosaicMode,
        },
        null,
        2
      );
    }

    if (tab === "background-change") {
      return JSON.stringify(
        {
          file: selectedFile?.name ?? null,
          imageUrl: imageUrl || null,
          prompt: prompt || "luxury hotel room, warm ambient lighting, elegant interior",
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
          imageUrl: imageUrl || null,
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
        imageUrl: imageUrl || null,
        prompt: prompt || "subtle natural motion, cinematic, realistic",
        duration,
        aspectRatio,
      },
      null,
      2
    );
  }, [tab, selectedFile, mosaicStrength, mosaicArea, mosaicMode, imageUrl, prompt, bgStrength, duration, aspectRatio]);

  const stopProgress = () => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const startProgress = (label = "処理中") => {
    stopProgress();
    setProgress(18);
    setProgressLabel(label);

    progressTimerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev;
        if (prev < 40) return prev + 8;
        if (prev < 70) return prev + 4;
        if (prev < 85) return prev + 2;
        return prev + 1;
      });
    }, 500);
  };

  const finishProgress = (label = "完了") => {
    stopProgress();
    setProgress(100);
    setProgressLabel(label);
  };

  const failProgress = (label = "エラー") => {
    stopProgress();
    setProgress(0);
    setProgressLabel(label);
  };

  const cancelProcessing = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    stopProgress();
    setLoading(false);
    setStatus("キャンセルしました");
    setProgress(0);
    setProgressLabel("キャンセルしました");
    setLog((prev) => [...prev, "キャンセル"]);
  };

  const resetResult = () => {
    setResultUrl("");
    setLog([]);
    setStatus("待機中");
    setProgress(0);
    setProgressLabel("待機中");
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

  const handleDownload = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    const ext = tab === "image-to-video" ? "mp4" : "png";
    a.download = `${tab}-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const runMosaic = async () => {
    if (!selectedFile) {
      alert("画像を選択してください");
      return;
    }

    const formData = new FormData();

    const faceBox = await detectFirstFace(selectedFile);
    if (!faceBox) {
      alert("顔を検出できませんでした");
      return;
    }

    const padX = Math.round(faceBox.width * 0.06);
    const padY = Math.round(faceBox.height * 0.08);
    const x = Math.max(0, faceBox.x - padX);
    const y = Math.max(0, faceBox.y - padY);
    const width = faceBox.width + padX * 2;
    const height = Math.round(faceBox.height + padY * 1.4);
    formData.append("file", selectedFile);
    formData.append("x", String(x));
    formData.append("y", String(y));
    formData.append("width", String(width));
    formData.append("height", String(height));
    formData.append("mode", mosaicMode);
    formData.append("strength", mosaicStrength);
    formData.append("area", mosaicArea);

    setLoading(true);
    startProgress("顔処理を実行中");
    setStatus("モザイク処理中");
    setLog(["POST /api/mosaic"]);

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const res = await fetch("/api/mosaic", { method: "POST", body: formData, signal: controller.signal });
      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setStatus("完了");
      finishProgress("完了");
      setLog((prev) => [...prev, "モザイク処理完了"]);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("キャンセルしました");
        failProgress("キャンセルしました");
        return;
      }
      const message = error instanceof Error ? error.message : "mosaic failed";
      setStatus("エラー");
      failProgress("エラー");
      setLog((prev) => [...prev, message]);
      alert(message);
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  const runFalApi = async (endpoint: string, extra: Record<string, string | number>) => {
    if (!selectedFile && !imageUrl.trim()) {
      alert("画像を選択するか、元画像URLを入力してください");
      return;
    }

    setLoading(true);

    const progressText =
      endpoint === "/api/background-change"
        ? "背景変更を実行中"
        : endpoint === "/api/pose-change"
          ? "ポーズ変更を実行中"
          : endpoint === "/api/image-to-video"
            ? "動画生成を実行中"
            : "処理中";

    startProgress(progressText);
    setStatus("API実行中");
    setLog([`POST ${endpoint}`]);

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      let res: Response;

      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        Object.entries(extra).forEach(([key, value]) => formData.append(key, String(value)));
        res = await fetch(endpoint, { method: "POST", body: formData, signal: controller.signal });
      } else {
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: imageUrl.trim(), ...extra }),
          signal: controller.signal,
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "request failed");

      const outputUrl = data.imageUrl || data.videoUrl || "";
      setResultUrl(outputUrl);
      setStatus("完了");
      finishProgress("完了");
      setLog((prev) => [
        ...prev,
        `requestId: ${data.requestId ?? "-"}`,
        outputUrl ? `result: ${outputUrl}` : "resultなし",
      ]);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("キャンセルしました");
        failProgress("キャンセルしました");
        return;
      }
      const message = error instanceof Error ? error.message : "request failed";
      setStatus("エラー");
      failProgress("エラー");
      setLog((prev) => [...prev, message]);
      alert(message);
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  const handleRun = async () => {
    resetResult();

    if (tab === "mosaic") return runMosaic();
    if (tab === "background-change") {
      return runFalApi("/api/background-change", {
        prompt: prompt || "luxury hotel room, warm ambient lighting, elegant interior",
        strength: bgStrength,
      });
    }
    if (tab === "pose-change") {
      return runFalApi("/api/pose-change", {
        prompt:
          prompt ||
          "Change only the pose to an elegant standing pose. Keep the same person, face, hairstyle, outfit, and background as consistent as possible.",
      });
    }
    return runFalApi("/api/image-to-video", {
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
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">画像加工・動画化検証アプリ</h1>
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
                tab === item.id ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white text-zinc-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          現在ご案内中の機能は「画像→動画」です。他機能は調整中です。
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">入力</div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">画像選択</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800">
                      画像を選択
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                      {selectedFile ? `選択中: ${selectedFile.name}` : "未選択"}
                    </div>
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
                </div>

                {tab !== "mosaic" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium">プロンプト</label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="min-h-32 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                    />
                  </div>
                )}

                {tab === "mosaic" && (
                  <div className="grid gap-4 sm:grid-cols-3">
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
                    <div>
                      <label className="mb-2 block text-sm font-medium">処理方式</label>
                      <select
                        value={mosaicMode}
                        onChange={(e) => setMosaicMode(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                      >
                        <option>モザイク</option>
                        <option>ブラー</option>
                        <option>ガウス</option>
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
                            bgStrength === value ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white text-zinc-700"
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

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">送信内容の確認</div>
              <pre className="overflow-x-auto rounded-2xl bg-zinc-950 p-4 text-xs leading-6 text-zinc-300">
                {payloadPreview}
              </pre>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">結果確認</h2>
                <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">{status}</div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
                  {previewUrl ? (
                    <img src={previewUrl} alt="input" className="aspect-[3/4] w-full object-cover" />
                  ) : (
                    <div className="aspect-[3/4] w-full bg-[linear-gradient(135deg,#d4d4d8,#f4f4f5)]" />
                  )}
                  <div className="border-t border-zinc-200 px-4 py-3 text-sm text-zinc-600">元画像</div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
                  {resultUrl ? (
                    tab === "image-to-video" ? (
                      <video src={resultUrl} controls className="aspect-video w-full bg-black object-contain" />
                    ) : (
                      <img src={resultUrl} alt="output" className="aspect-[3/4] w-full object-cover" />
                    )
                  ) : (
                    <div className="aspect-[3/4] w-full bg-[linear-gradient(135deg,#e4d4b7,#faf7f0)]" />
                  )}
                  <div className="border-t border-zinc-200 px-4 py-3 text-sm text-zinc-600">処理結果</div>
                </div>
              </div>

              {resultUrl && (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                  >
                    ダウンロード
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">進行状況</div>
              <div className="space-y-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-zinc-700">{progressLabel}</span>
                  <span className="text-zinc-500">{progress}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-zinc-900 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {loading && (
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={cancelProcessing}
                      className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      キャンセル
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
