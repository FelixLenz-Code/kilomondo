"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ocrImage } from "@/lib/image-client";

/**
 * Lets the user photograph the odometer; runs client-side OCR (tesseract.js)
 * and reports the detected number via onDetect. The dependency is loaded
 * lazily so it only downloads when actually used.
 */
export function OdometerCapture({
  onDetect,
}: {
  onDetect: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setStatus("Bild wird ausgewertet…");
    setPreview(URL.createObjectURL(file));
    try {
      const text = await ocrImage(file, "0123456789");
      // Pick the longest run of digits as the odometer reading.
      const matches = text.match(/\d+/g) ?? [];
      const best = matches.sort((a, b) => b.length - a.length)[0];
      if (best) {
        onDetect(best);
        setStatus(`Erkannt: ${best} km — bitte prüfen und ggf. korrigieren.`);
      } else {
        setStatus("Keine Ziffern erkannt — bitte manuell eingeben.");
      }
    } catch {
      setStatus("Texterkennung fehlgeschlagen — bitte manuell eingeben.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="animate-spin" />
        ) : status && !busy ? (
          <Check className="text-accent" />
        ) : (
          <Camera />
        )}
        Kilometerstand abfotografieren
      </Button>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Aufgenommenes Foto"
          className="max-h-40 w-full rounded-md border border-border object-cover"
        />
      )}
      {status && <p className="text-xs text-muted-foreground">{status}</p>}
    </div>
  );
}
