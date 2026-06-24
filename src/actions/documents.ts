"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, getVehicleAccess } from "@/lib/auth/guards";
import { documentSchema } from "@/lib/validation";
import { applyDocumentReminder } from "@/lib/documents";
import {
  saveDocumentAttachments,
  syncDocumentAttachments,
  deleteDocumentAttachments,
} from "@/lib/attachments";

export type ActionState = { error?: string; success?: string };

function fail(parsed: { error: { errors: { message: string }[] } }): ActionState {
  return { error: parsed.error.errors[0]?.message ?? "Ungültige Eingabe." };
}

async function canEdit(vehicleId: string): Promise<boolean> {
  const user = await requireUser();
  const access = await getVehicleAccess(vehicleId, user.id);
  return access != null && access.level !== "VIEWER";
}

function refresh(vehicleId: string) {
  revalidatePath(`/vehicles/${vehicleId}/documents`);
  revalidatePath(`/vehicles/${vehicleId}/reminders`);
  revalidatePath(`/vehicles/${vehicleId}`);
}

function parse(formData: FormData) {
  return documentSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    issueDate: formData.get("issueDate"),
    expiresAt: formData.get("expiresAt"),
    notes: formData.get("notes"),
    remind: formData.get("remind") === "on" || formData.get("remind") === "true",
    leadDays: formData.get("leadDays"),
  });
}

export async function createDocumentAction(
  vehicleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await canEdit(vehicleId))) return { error: "Keine Berechtigung." };
  const parsed = parse(formData);
  if (!parsed.success) return fail(parsed);
  const { remind, leadDays, ...fields } = parsed.data;

  const reminderId = await applyDocumentReminder({
    vehicleId,
    existingReminderId: null,
    title: fields.title,
    remind,
    expiresAt: fields.expiresAt ?? null,
    leadDays,
  });

  const doc = await db.document.create({
    data: { ...fields, vehicleId, reminderId },
  });
  await saveDocumentAttachments(
    formData.getAll("files"),
    formData.getAll("filesNames"),
    doc.id
  );

  refresh(vehicleId);
  return { success: "Dokument gespeichert." };
}

export async function updateDocumentAction(
  vehicleId: string,
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await canEdit(vehicleId))) return { error: "Keine Berechtigung." };
  const parsed = parse(formData);
  if (!parsed.success) return fail(parsed);
  const { remind, leadDays, ...fields } = parsed.data;

  const existing = await db.document.findFirst({
    where: { id, vehicleId },
    select: { reminderId: true },
  });
  if (!existing) return { error: "Dokument nicht gefunden." };

  const reminderId = await applyDocumentReminder({
    vehicleId,
    existingReminderId: existing.reminderId,
    title: fields.title,
    remind,
    expiresAt: fields.expiresAt ?? null,
    leadDays,
  });

  await db.document.updateMany({
    where: { id, vehicleId },
    data: {
      ...fields,
      issueDate: fields.issueDate ?? null,
      expiresAt: fields.expiresAt ?? null,
      reminderId,
    },
  });
  await syncDocumentAttachments(
    id,
    formData.getAll("keepFiles").map(String),
    formData.getAll("files"),
    formData.getAll("filesNames")
  );

  refresh(vehicleId);
  return { success: "Dokument aktualisiert." };
}

export async function deleteDocumentAction(vehicleId: string, id: string) {
  if (!(await canEdit(vehicleId))) return;
  const doc = await db.document.findFirst({
    where: { id, vehicleId },
    select: { reminderId: true },
  });
  await db.document.deleteMany({ where: { id, vehicleId } });
  await deleteDocumentAttachments(id);
  if (doc?.reminderId) {
    await db.reminder.deleteMany({ where: { id: doc.reminderId } });
  }
  refresh(vehicleId);
}
