"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, X, ChevronLeft, ChevronRight } from "lucide-react";

export type GalleryImage = { id: string; mimeType: string; label: string };

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export function ImageGallery({
  images,
  vehicleName,
}: {
  images: GalleryImage[];
  vehicleName: string;
}) {
  const [open, setOpen] = useState<number | null>(null);

  const slug =
    vehicleName.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9_-]/g, "") ||
    "bild";
  const fileName = (img: GalleryImage, i: number) =>
    `${slug}-${i + 1}.${EXT[img.mimeType] ?? "jpg"}`;

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (d: number) =>
      setOpen((o) => (o === null ? o : (o + d + images.length) % images.length)),
    [images.length]
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, step]);

  if (images.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Noch keine Bilder. Bilder werden über das Titelbild sowie Reparatur- und
        Pflege-Einträge hochgeladen.
      </p>
    );
  }

  const current = open === null ? null : images[open];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img, i) => (
          <div
            key={img.id}
            className="group relative overflow-hidden rounded-lg border border-border bg-background/40"
          >
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="block w-full"
              title="Vergrößern"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/images/${img.id}`}
                alt={img.label}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-105"
              />
            </button>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
              <span className="block truncate text-[11px] text-white/90">
                {img.label}
              </span>
            </div>
            <a
              href={`/api/images/${img.id}`}
              download={fileName(img, i)}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-2 top-2 rounded-md bg-background/70 p-1.5 text-foreground backdrop-blur transition-opacity hover:bg-background sm:opacity-0 sm:group-hover:opacity-100"
              title="Herunterladen"
            >
              <Download className="size-4" />
            </a>
          </div>
        ))}
      </div>

      {current && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            title="Schließen (Esc)"
          >
            <X className="size-5" />
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:left-4"
                title="Zurück (←)"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:right-4"
                title="Weiter (→)"
              >
                <ChevronRight className="size-6" />
              </button>
            </>
          )}

          <figure
            className="flex max-h-full max-w-full flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/images/${current.id}`}
              alt={current.label}
              className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain"
            />
            <figcaption className="flex items-center gap-4 text-sm text-white/90">
              <span className="truncate">{current.label}</span>
              <a
                href={`/api/images/${current.id}`}
                download={fileName(current, open!)}
                className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 font-medium hover:bg-white/20"
              >
                <Download className="size-4" /> Herunterladen
              </a>
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
