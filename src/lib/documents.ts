import "server-only";
import type { DocumentCategory } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Create/update/remove the auto-reminder linked to a document's expiry date.
 * Returns the reminder id to store on the document (or null when none).
 */
export async function applyDocumentReminder(opts: {
  vehicleId: string;
  existingReminderId: string | null;
  title: string;
  remind: boolean;
  expiresAt: Date | null;
  leadDays: number;
}): Promise<string | null> {
  const wantReminder = opts.remind && !!opts.expiresAt;

  if (!wantReminder) {
    if (opts.existingReminderId) {
      await db.reminder.deleteMany({ where: { id: opts.existingReminderId } });
    }
    return null;
  }

  const title = `Dokument läuft ab: ${opts.title}`;
  if (opts.existingReminderId) {
    const { count } = await db.reminder.updateMany({
      where: { id: opts.existingReminderId },
      data: {
        title,
        dueDate: opts.expiresAt,
        leadDays: opts.leadDays,
        active: true,
        lastNotifiedAt: null, // re-arm on any change
      },
    });
    if (count > 0) return opts.existingReminderId;
  }

  const created = await db.reminder.create({
    data: {
      vehicleId: opts.vehicleId,
      type: "CUSTOM",
      title,
      dueDate: opts.expiresAt,
      leadDays: opts.leadDays,
      source: "DOCUMENT",
      active: true,
    },
  });
  return created.id;
}

export type ExpiryStatus = "expired" | "soon" | "ok";

/** Classify a document's expiry: overdue, due within 30 days, or fine. */
export function documentExpiryStatus(
  expiresAt: Date | null,
  now = new Date()
): ExpiryStatus | null {
  if (!expiresAt) return null;
  const days = (expiresAt.getTime() - now.getTime()) / 86_400_000;
  if (days < 0) return "expired";
  if (days <= 30) return "soon";
  return "ok";
}

export function documentCategoryLabel(category: DocumentCategory): string {
  switch (category) {
    case "REGISTRATION":
      return "Zulassung";
    case "INSURANCE":
      return "Versicherung";
    case "LICENSE":
      return "Führerschein";
    case "WARRANTY":
      return "Garantie";
    case "INVOICE":
      return "Rechnung";
    case "OTHER":
      return "Sonstiges";
  }
}
