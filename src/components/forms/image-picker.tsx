"use client";

import { useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { downscaleImage } from "@/lib/image-client";

const REMOVE = "remove";

/**
 * Image field that downscales the chosen photo client-side and submits it as a
 * base64 data-URL via a hidden input. Supports camera capture, an existing
 * image (edit), and removal.
 */
export function ImagePicker({
  name,
  label,
  existingImageId,
  capture = false,
}: {
  name: string;
  label: string;
  existingImageId?: string | null;
  capture?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // hidden value: "" = unchanged, data-URL = new image, "remove" = delete
  const [value, setValue] = useState("");
  const [preview, setPreview] = useState<string | null>(
    existingImageId ? `/api/images/${existingImageId}` : null
  );

  async function onPick(file: File) {
    setBusy(true);
    try {
      const url = await downscaleImage(file);
      setValue(url);
      setPreview(url);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    setValue(existingImageId ? REMOVE : "");
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <input type="hidden" name={name} value={value} />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        {...(capture ? { capture: "environment" as const } : {})}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPick(f);
        }}
      />
      {preview ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={label}
            className="h-40 w-full rounded-lg border border-border object-cover"
          />
          <button
            type="button"
            onClick={remove}
            className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-destructive hover:text-destructive-foreground"
            aria-label="Bild entfernen"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-24 w-full border-dashed"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          Bild auswählen
        </Button>
      )}
    </div>
  );
}
