"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, getVehicleAccess } from "@/lib/auth/guards";
import { tireSetSchema, tireChangeSchema, tireMeasurementSchema } from "@/lib/validation";

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
  revalidatePath(`/vehicles/${vehicleId}/tires`);
  revalidatePath(`/vehicles/${vehicleId}`);
}

/* ---------------- Tire wear reminder ---------------- */

// Create/update/remove the reminder linked to a set's wear-alert threshold.
// Mirrors lib/documents `applyDocumentReminder`. The scheduler decides when it
// actually fires (once the lowest measured tread reaches `wearAlertMm`).
async function applyTireReminder(opts: {
  vehicleId: string;
  existingReminderId: string | null;
  name: string;
  wearAlertMm: number | null | undefined;
  retired: boolean;
}): Promise<string | null> {
  const want = opts.wearAlertMm != null && !opts.retired;
  if (!want) {
    if (opts.existingReminderId) {
      await db.reminder.deleteMany({ where: { id: opts.existingReminderId } });
    }
    return null;
  }

  const title = `Reifen bald wechseln: ${opts.name}`;
  if (opts.existingReminderId) {
    const { count } = await db.reminder.updateMany({
      where: { id: opts.existingReminderId },
      data: { title, active: true },
    });
    if (count > 0) return opts.existingReminderId;
  }

  const created = await db.reminder.create({
    data: { vehicleId: opts.vehicleId, type: "CUSTOM", title, source: "TIRE", active: true },
  });
  return created.id;
}

/* ---------------- Tire sets ---------------- */

export async function createTireSetAction(
  vehicleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await canEdit(vehicleId))) return { error: "Keine Berechtigung." };
  const parsed = tireSetSchema.safeParse({
    name: formData.get("name"),
    season: formData.get("season"),
    dimension: formData.get("dimension"),
    brand: formData.get("brand"),
    purchaseDate: formData.get("purchaseDate"),
    treadDepthMm: formData.get("treadDepthMm"),
    storageLocation: formData.get("storageLocation"),
    retired: formData.get("retired") === "on" || formData.get("retired") === "true",
    notes: formData.get("notes"),
  });
  if (!parsed.success) return fail(parsed);

  const created = await db.tireSet.create({ data: { ...parsed.data, vehicleId } });
  const reminderId = await applyTireReminder({
    vehicleId,
    existingReminderId: null,
    name: created.name,
    wearAlertMm: parsed.data.wearAlertMm,
    retired: parsed.data.retired,
  });
  if (reminderId) {
    await db.tireSet.update({ where: { id: created.id }, data: { reminderId } });
  }
  refresh(vehicleId);
  return { success: "Radsatz gespeichert." };
}

export async function updateTireSetAction(
  vehicleId: string,
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await canEdit(vehicleId))) return { error: "Keine Berechtigung." };
  const parsed = tireSetSchema.safeParse({
    name: formData.get("name"),
    season: formData.get("season"),
    dimension: formData.get("dimension"),
    brand: formData.get("brand"),
    purchaseDate: formData.get("purchaseDate"),
    treadDepthMm: formData.get("treadDepthMm"),
    storageLocation: formData.get("storageLocation"),
    retired: formData.get("retired") === "on" || formData.get("retired") === "true",
    notes: formData.get("notes"),
  });
  if (!parsed.success) return fail(parsed);

  const existing = await db.tireSet.findFirst({
    where: { id, vehicleId },
    select: { reminderId: true },
  });
  if (!existing) return { error: "Radsatz nicht gefunden." };

  await db.tireSet.update({
    where: { id },
    data: {
      ...parsed.data,
      purchaseDate: parsed.data.purchaseDate ?? null,
      treadDepthMm: parsed.data.treadDepthMm ?? null,
      wearAlertMm: parsed.data.wearAlertMm ?? null,
    },
  });

  const reminderId = await applyTireReminder({
    vehicleId,
    existingReminderId: existing.reminderId,
    name: parsed.data.name,
    wearAlertMm: parsed.data.wearAlertMm,
    retired: parsed.data.retired,
  });
  if (reminderId !== existing.reminderId) {
    await db.tireSet.update({ where: { id }, data: { reminderId } });
  }
  refresh(vehicleId);
  return { success: "Radsatz aktualisiert." };
}

export async function deleteTireSetAction(vehicleId: string, id: string) {
  if (!(await canEdit(vehicleId))) return;
  const set = await db.tireSet.findFirst({ where: { id, vehicleId }, select: { reminderId: true } });
  await db.tireSet.deleteMany({ where: { id, vehicleId } });
  if (set?.reminderId) await db.reminder.deleteMany({ where: { id: set.reminderId } });
  refresh(vehicleId);
}

/* ---------------- Tire changes (mount events) ---------------- */

export async function createTireChangeAction(
  vehicleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await canEdit(vehicleId))) return { error: "Keine Berechtigung." };
  const parsed = tireChangeSchema.safeParse({
    tireSetId: formData.get("tireSetId"),
    date: formData.get("date"),
    odometer: formData.get("odometer"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return fail(parsed);

  // The set must belong to this vehicle.
  const set = await db.tireSet.findFirst({
    where: { id: parsed.data.tireSetId, vehicleId },
    select: { id: true },
  });
  if (!set) return { error: "Radsatz nicht gefunden." };

  await db.tireChange.create({ data: { ...parsed.data, vehicleId } });
  refresh(vehicleId);
  return { success: "Radwechsel gespeichert." };
}

export async function deleteTireChangeAction(vehicleId: string, id: string) {
  if (!(await canEdit(vehicleId))) return;
  await db.tireChange.deleteMany({ where: { id, vehicleId } });
  refresh(vehicleId);
}

/* ---------------- Tire measurements (tread-depth readings) ---------------- */

// Keep TireSet.treadDepthMm in sync with the most recent reading, so the
// existing "latest depth" displays reflect the measurement history.
async function syncSetTreadDepth(tireSetId: string) {
  const latest = await db.tireMeasurement.findFirst({
    where: { tireSetId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { treadDepthMm: true },
  });
  await db.tireSet.update({
    where: { id: tireSetId },
    data: { treadDepthMm: latest?.treadDepthMm ?? null },
  });
}

export async function createTireMeasurementAction(
  vehicleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await canEdit(vehicleId))) return { error: "Keine Berechtigung." };
  const parsed = tireMeasurementSchema.safeParse({
    tireSetId: formData.get("tireSetId"),
    date: formData.get("date"),
    treadFrontLeftMm: formData.get("treadFrontLeftMm"),
    treadFrontRightMm: formData.get("treadFrontRightMm"),
    treadRearLeftMm: formData.get("treadRearLeftMm"),
    treadRearRightMm: formData.get("treadRearRightMm"),
    odometer: formData.get("odometer"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return fail(parsed);

  const set = await db.tireSet.findFirst({
    where: { id: parsed.data.tireSetId, vehicleId },
    select: { id: true, reminderId: true },
  });
  if (!set) return { error: "Radsatz nicht gefunden." };

  // The set-level depth is the average of whichever tires were measured.
  const perTire = [
    parsed.data.treadFrontLeftMm,
    parsed.data.treadFrontRightMm,
    parsed.data.treadRearLeftMm,
    parsed.data.treadRearRightMm,
  ].filter((v): v is number => v != null);
  const treadDepthMm = perTire.reduce((a, b) => a + b, 0) / perTire.length;

  await db.tireMeasurement.create({ data: { ...parsed.data, treadDepthMm, vehicleId } });
  await syncSetTreadDepth(parsed.data.tireSetId);
  // Re-arm the wear reminder so the scheduler re-checks this fresh reading.
  if (set.reminderId) {
    await db.reminder.updateMany({ where: { id: set.reminderId }, data: { lastNotifiedAt: null } });
  }
  refresh(vehicleId);
  return { success: "Profiltiefe gespeichert." };
}

export async function deleteTireMeasurementAction(vehicleId: string, id: string) {
  if (!(await canEdit(vehicleId))) return;
  const m = await db.tireMeasurement.findFirst({
    where: { id, vehicleId },
    select: { tireSetId: true },
  });
  await db.tireMeasurement.deleteMany({ where: { id, vehicleId } });
  if (m) await syncSetTreadDepth(m.tireSetId);
  refresh(vehicleId);
}
