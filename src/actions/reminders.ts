"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, getVehicleAccess } from "@/lib/auth/guards";
import { reminderSchema } from "@/lib/validation";

export type ActionState = { error?: string; success?: string };

async function assertCanEdit(vehicleId: string) {
  const user = await requireUser();
  const access = await getVehicleAccess(vehicleId, user.id);
  if (!access || access.level === "VIEWER") throw new Error("forbidden");
}

export async function createReminderAction(
  vehicleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertCanEdit(vehicleId);
  const parsed = reminderSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title"),
    dueDate: formData.get("dueDate"),
    dueOdometer: formData.get("dueOdometer"),
    leadDays: formData.get("leadDays"),
    intervalDays: formData.get("intervalDays"),
    recurrenceMonths: formData.get("recurrenceMonths"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Ungültige Eingabe." };
  }
  const d = parsed.data;

  // Each reminder needs something to trigger on.
  if (d.type === "LOG") {
    d.intervalDays = d.intervalDays ?? 30;
  } else if (!d.dueDate && d.dueOdometer == null) {
    return { error: "Bitte ein Fälligkeitsdatum oder einen Kilometerstand angeben." };
  }

  await db.reminder.create({ data: { ...d, vehicleId, source: "MANUAL" } });
  revalidatePath(`/vehicles/${vehicleId}/reminders`);
  return { success: "Erinnerung gespeichert." };
}

export async function updateReminderAction(
  vehicleId: string,
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertCanEdit(vehicleId);
  const parsed = reminderSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title"),
    dueDate: formData.get("dueDate"),
    dueOdometer: formData.get("dueOdometer"),
    leadDays: formData.get("leadDays"),
    intervalDays: formData.get("intervalDays"),
    recurrenceMonths: formData.get("recurrenceMonths"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Ungültige Eingabe." };
  }
  const d = parsed.data;
  if (d.type === "LOG") {
    d.intervalDays = d.intervalDays ?? 30;
  } else if (!d.dueDate && d.dueOdometer == null) {
    return { error: "Bitte ein Fälligkeitsdatum oder einen Kilometerstand angeben." };
  }

  // For non-LOG reminders, clear the trigger that wasn't used.
  const data = {
    ...d,
    dueDate: d.type === "LOG" ? null : d.dueDate ?? null,
    dueOdometer: d.type === "LOG" ? null : d.dueOdometer ?? null,
    intervalDays: d.type === "LOG" ? d.intervalDays : null,
    // Editing makes it user-managed, so auto-sync won't overwrite it; allow it
    // to fire again under the new schedule.
    source: "MANUAL",
    lastNotifiedAt: null,
  };
  const { count } = await db.reminder.updateMany({ where: { id, vehicleId }, data });
  if (count === 0) return { error: "Erinnerung nicht gefunden." };

  revalidatePath(`/vehicles/${vehicleId}/reminders`);
  return { success: "Erinnerung aktualisiert." };
}

/** Create a reminder from an auto-generated suggestion (source = AUTO). */
export async function acceptReminderSuggestionAction(vehicleId: string, formData: FormData) {
  await assertCanEdit(vehicleId);
  const type = String(formData.get("type") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const dueRaw = String(formData.get("dueDate") ?? "");
  const recurrence = Number(formData.get("recurrenceMonths"));
  const dueDate = dueRaw ? new Date(dueRaw) : null;

  if (!["INSPECTION", "SERVICE", "INSURANCE", "TAX"].includes(type)) return;
  if (!title || !dueDate || isNaN(dueDate.getTime())) return;

  await db.reminder.create({
    data: {
      vehicleId,
      type: type as "INSPECTION" | "SERVICE" | "INSURANCE" | "TAX",
      title,
      dueDate,
      leadDays: 28,
      recurrenceMonths: Number.isFinite(recurrence) && recurrence > 0 ? recurrence : null,
      source: "AUTO",
    },
  });
  revalidatePath(`/vehicles/${vehicleId}/reminders`);
}

export async function deleteReminderAction(vehicleId: string, id: string) {
  await assertCanEdit(vehicleId);
  // For a tire-wear reminder, also clear the link + threshold on its set, so the
  // set doesn't keep a dangling reminderId and doesn't recreate the reminder on
  // its next save. Deleting it here means: turn the wear alert off. No-op for
  // every other reminder.
  await db.tireSet.updateMany({
    where: { vehicleId, reminderId: id },
    data: { reminderId: null, wearAlertMm: null },
  });
  await db.reminder.deleteMany({ where: { id, vehicleId } });
  revalidatePath(`/vehicles/${vehicleId}/reminders`);
  revalidatePath(`/vehicles/${vehicleId}/tires`);
}

export async function toggleReminderAction(vehicleId: string, id: string) {
  await assertCanEdit(vehicleId);
  const r = await db.reminder.findFirst({ where: { id, vehicleId }, select: { active: true } });
  if (!r) return;
  await db.reminder.update({
    where: { id },
    // Re-activating clears the last-notified marker so it can fire again.
    data: { active: !r.active, ...(r.active ? {} : { lastNotifiedAt: null }) },
  });
  revalidatePath(`/vehicles/${vehicleId}/reminders`);
}
