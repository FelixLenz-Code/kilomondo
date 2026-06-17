"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ocrImage } from "@/lib/image-client";

/**
 * Photograph the fuel pump display and try to read the amount (liters) and the
 * price per liter via OCR. Results are best-effort — the user confirms/corrects.
 */
export function FuelPumpCapture({
  onDetect,
}: {
  onDetect: (values: { amount?: string; price?: string }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setStatus("Zapfsäule wird ausgewertet…");
    setPreview(URL.createObjectURL(file));
    try {
      const text = await ocrImage(file, "0123456789.,");
      const nums = (text.match(/\d+[.,]\d+/g) ?? []).map((s) =>
        parseFloat(s.replace(",", "."))
      );

      // Price per liter: a value in the typical fuel-price range.
      const price = nums.find((n) => n >= 0.8 && n <= 2.5);
      // Amount (liters): a plausible volume that isn't the price.
      const amount = nums
        .filter((n) => n !== price && n >= 3 && n <= 200)
        .sort((a, b) => a - b)[0];

      const result: { amount?: string; price?: string } = {};
      if (price) result.price = price.toFixed(3);
      if (amount) result.amount = amount.toFixed(2);

      if (price || amount) {
        onDetect(result);
        setStatus(
          `Erkannt — ${amount ? `${amount.toFixed(2)} L` : "Menge?"} · ${
            price ? `${price.toFixed(3)} €/L` : "Preis?"
          }. Bitte prüfen.`
        );
      } else {
        setStatus("Keine Werte erkannt — bitte manuell eingeben.");
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
        ) : status ? (
          <Check className="text-accent" />
        ) : (
          <Camera />
        )}
        Zapfsäule abfotografieren
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
