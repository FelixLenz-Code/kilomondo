// Browser-only helpers for downscaling images before upload.

const MAX_DIM = 1600;
const QUALITY = 0.85;

export async function downscaleImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", QUALITY);
}

/**
 * Run OCR on an image file. tesseract.js is loaded lazily and all engine and
 * language assets are served from this app (/public/tesseract) — no external
 * CDN is contacted, so OCR works fully offline.
 */
export async function ocrImage(file: File, whitelist?: string): Promise<string> {
  const { createWorker, OEM } = await import("tesseract.js");
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/core",
    langPath: "/tesseract/lang",
  });
  if (whitelist) {
    await worker.setParameters({ tessedit_char_whitelist: whitelist });
  }
  const { data } = await worker.recognize(file);
  await worker.terminate();
  return data.text;
}
