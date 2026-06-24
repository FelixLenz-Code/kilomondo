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

  await db.tireSet.create({ data: { ...parsed.data, vehicleId } });
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

  const { count } = await db.tireSet.updateMany({
    where: { id, vehicleId },
    data: {
      ...parsed.data,
      purchaseDate: parsed.data.purchaseDate ?? null,
      treadDepthMm: parsed.data.treadDepthMm ?? null,
    },
  });
  if (count === 0) return { error: "Radsatz nicht gefunden." };
  refresh(vehicleId);
  return { success: "Radsatz aktualisiert." };
}

export async function deleteTireSetAction(vehicleId: string, id: string) {
  if (!(await canEdit(vehicleId))) return;
  await db.tireSet.deleteMany({ where: { id, vehicleId } });
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
    treadDepthMm: formData.get("treadDepthMm"),
    odometer: formData.get("odometer"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return fail(parsed);

  const set = await db.tireSet.findFirst({
    where: { id: parsed.data.tireSetId, vehicleId },
    select: { id: true },
  });
  if (!set) return { error: "Radsatz nicht gefunden." };

  await db.tireMeasurement.create({ data: { ...parsed.data, vehicleId } });
  await syncSetTreadDepth(parsed.data.tireSetId);
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
