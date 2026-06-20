import "server-only";
import { db } from "@/lib/db";

const MAX_BYTES = 20 * 1024 * 1024;

// Allowed attachment MIME types. PDFs cover the common case (invoices,
// reports); images let users attach a snapshot of a paper receipt too.
const ALLOWED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
]);

function parseDataUrl(
  value: unknown
): { mimeType: string; data: Uint8Array<ArrayBuffer> } | null {
  if (typeof value !== "string" || !value.startsWith("data:")) return null;
  const match = /^data:([a-zA-Z0-9.+/-]+);base64,(.+)$/.exec(value);
  if (!match) return null;
  const mimeType = match[1];
  if (!ALLOWED.has(mimeType)) return null;
  const buf = Buffer.from(match[2], "base64");
  if (buf.length === 0 || buf.length > MAX_BYTES) return null;
  const data = new Uint8Array(buf.length);
  data.set(buf);
  return { mimeType, data };
}

/** Strip any path components and clamp the length of a user-supplied name. */
function sanitizeFileName(value: unknown, mimeType: string): string {
  const fallback = mimeType === "application/pdf" ? "anhang.pdf" : "anhang";
  if (typeof value !== "string") return fallback;
  const base = value.split(/[\\/]/).pop()?.trim() ?? "";
  if (!base) return fallback;
  return base.slice(0, 200);
}

/**
 * Persist a repair entry's attachments. Each item is a base64 data-URL paired
 * with its original file name (parallel arrays, read with formData.getAll).
 * Invalid / oversized / disallowed entries are skipped.
 */
export async function saveRepairAttachments(
  values: unknown[],
  names: unknown[],
  repairId: string
): Promise<void> {
  for (let i = 0; i < values.length; i++) {
    const parsed = parseDataUrl(values[i]);
    if (!parsed) continue;
    await db.attachment.create({
      data: {
        mimeType: parsed.mimeType,
        fileName: sanitizeFileName(names[i], parsed.mimeType),
        size: parsed.data.byteLength,
        data: parsed.data,
        repairId,
      },
    });
  }
}

export async function deleteRepairAttachments(repairId: string): Promise<void> {
  await db.attachment.deleteMany({ where: { repairId } });
}

/**
 * Reconcile a repair's attachments on update: delete the ones no longer in
 * `keepIds`, then persist any newly added files.
 */
export async function syncRepairAttachments(
  repairId: string,
  keepIds: string[],
  newValues: unknown[],
  newNames: unknown[]
): Promise<void> {
  await db.attachment.deleteMany({
    where: keepIds.length
      ? { repairId, id: { notIn: keepIds } }
      : { repairId },
  });
  await saveRepairAttachments(newValues, newNames, repairId);
}
