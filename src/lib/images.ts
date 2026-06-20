import "server-only";
import type { ImageKind } from "@prisma/client";
import { db } from "@/lib/db";

const MAX_BYTES = 12 * 1024 * 1024;

// Only raster formats are accepted. SVG is deliberately excluded: it can carry
// scripts and is served same-origin, so allowing it would enable stored XSS
// when an image is opened as a top-level document.
const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

function parseDataUrl(
  value: unknown
): { mimeType: string; data: Uint8Array<ArrayBuffer> } | null {
  if (typeof value !== "string" || !value.startsWith("data:")) return null;
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(value);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_MIME.has(mimeType)) return null;
  const buf = Buffer.from(match[2], "base64");
  if (buf.length === 0 || buf.length > MAX_BYTES) return null;
  // Copy into a fresh ArrayBuffer-backed array so the type is Uint8Array<ArrayBuffer>.
  const data = new Uint8Array(buf.length);
  data.set(buf);
  return { mimeType, data };
}

/**
 * Persist multiple data-URL images linked to a repair or cleaning entry,
 * tagged BEFORE or AFTER. Invalid/empty values are skipped.
 */
export async function saveEntryImages(
  values: unknown[],
  link: { repairId?: string; cleaningId?: string; kind: ImageKind }
): Promise<void> {
  for (const value of values) {
    const parsed = parseDataUrl(value);
    if (!parsed) continue;
    await db.image.create({
      data: {
        mimeType: parsed.mimeType,
        data: parsed.data,
        repairId: link.repairId,
        cleaningId: link.cleaningId,
        kind: link.kind,
      },
    });
  }
}

/** Sentinel value a client sends to request removal of an existing image. */
export const IMAGE_REMOVE = "remove";

/**
 * Persist a base64 data-URL as an Image row and return its id.
 * Returns null for empty/invalid input.
 */
export async function saveDataUrlImage(value: unknown): Promise<string | null> {
  const parsed = parseDataUrl(value);
  if (!parsed) return null;
  const image = await db.image.create({
    data: { mimeType: parsed.mimeType, data: parsed.data },
  });
  return image.id;
}

export async function deleteImage(id: string | null | undefined): Promise<void> {
  if (!id) return;
  await db.image.delete({ where: { id } }).catch(() => {});
}

/**
 * Resolve an image form field on UPDATE:
 * - data-URL  -> save new image, delete old, return new id
 * - "remove"  -> delete old, return null
 * - otherwise -> keep existing (return current id)
 */
export async function resolveImageUpdate(
  value: unknown,
  currentId: string | null
): Promise<string | null> {
  if (value === IMAGE_REMOVE) {
    await deleteImage(currentId);
    return null;
  }
  if (typeof value === "string" && value.startsWith("data:")) {
    const id = await saveDataUrlImage(value);
    if (id) {
      await deleteImage(currentId);
      return id;
    }
  }
  return currentId;
}
