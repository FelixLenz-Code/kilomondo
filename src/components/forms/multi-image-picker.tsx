"use client";

import { useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { downscaleImage } from "@/lib/image-client";

/**
 * Lets the user add multiple images. Each is downscaled client-side and
 * submitted as a separate hidden input sharing `name` (read server-side with
 * formData.getAll(name)).
 */
export function MultiImagePicker({
  name,
  label,
}: {
  name: string;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<string[]>([]);

  async function onFiles(files: FileList) {
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        urls.push(await downscaleImage(file));
      }
      setImages((prev) => [...prev, ...urls]);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {images.map((url, i) => (
        <input key={i} type="hidden" name={name} value={url} />
      ))}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void onFiles(e.target.files);
        }}
      />
      <div className="grid grid-cols-3 gap-2">
        {images.map((url, i) => (
          <div key={i} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${label} ${i + 1}`}
              className="h-20 w-full rounded-md border border-border object-cover"
            />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-destructive hover:text-destructive-foreground"
              aria-label="Entfernen"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="h-20 border-dashed"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}
        </Button>
      </div>
    </div>
  );
}
