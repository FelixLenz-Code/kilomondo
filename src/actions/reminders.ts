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

export async function deleteReminderAction(vehicleId: string, id: string) {
  await assertCanEdit(vehicleId);
  await db.reminder.deleteMany({ where: { id, vehicleId } });
  revalidatePath(`/vehicles/${vehicleId}/reminders`);
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
