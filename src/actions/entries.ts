"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, getOwnedVehicle } from "@/lib/auth/guards";
import { saveEntryImages } from "@/lib/images";
import {
  fuelSchema,
  odometerSchema,
  repairSchema,
  cleaningSchema,
} from "@/lib/validation";

export type ActionState = { error?: string; success?: string };

async function assertOwner(vehicleId: string) {
  const user = await requireUser();
  const owned = await getOwnedVehicle(vehicleId, user.id);
  if (!owned) throw new Error("forbidden");
  return owned;
}

function fail(parsed: { error: { errors: { message: string }[] } }): ActionState {
  return { error: parsed.error.errors[0]?.message ?? "Ungültige Eingabe." };
}

/* ---------------- Fuel ---------------- */

export async function createFuelAction(
  vehicleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertOwner(vehicleId);
  const parsed = fuelSchema.safeParse({
    date: formData.get("date"),
    odometer: formData.get("odometer"),
    amount: formData.get("amount"),
    pricePerUnit: formData.get("pricePerUnit"),
    totalCost: formData.get("totalCost"),
    isFullTank: formData.get("isFullTank") === "on" || formData.get("isFullTank") === "true",
    station: formData.get("station"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return fail(parsed);

  await db.fuelEntry.create({ data: { ...parsed.data, vehicleId } });
  revalidatePath(`/vehicles/${vehicleId}/fuel`);
  revalidatePath(`/vehicles/${vehicleId}`);
  return { success: "Tankung gespeichert." };
}

export async function deleteFuelAction(vehicleId: string, id: string) {
  await assertOwner(vehicleId);
  await db.fuelEntry.deleteMany({ where: { id, vehicleId } });
  revalidatePath(`/vehicles/${vehicleId}/fuel`);
  revalidatePath(`/vehicles/${vehicleId}`);
}

/* ---------------- Odometer ---------------- */

export async function createOdometerAction(
  vehicleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertOwner(vehicleId);
  const parsed = odometerSchema.safeParse({
    date: formData.get("date"),
    odometer: formData.get("odometer"),
    note: formData.get("note"),
  });
  if (!parsed.success) return fail(parsed);

  await db.odometerEntry.create({ data: { ...parsed.data, vehicleId } });
  revalidatePath(`/vehicles/${vehicleId}/mileage`);
  revalidatePath(`/vehicles/${vehicleId}`);
  return { success: "Kilometerstand gespeichert." };
}

export async function deleteOdometerAction(vehicleId: string, id: string) {
  await assertOwner(vehicleId);
  await db.odometerEntry.deleteMany({ where: { id, vehicleId } });
  revalidatePath(`/vehicles/${vehicleId}/mileage`);
  revalidatePath(`/vehicles/${vehicleId}`);
}

/* ---------------- Repairs ---------------- */

export async function createRepairAction(
  vehicleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertOwner(vehicleId);
  const parsed = repairSchema.safeParse({
    date: formData.get("date"),
    odometer: formData.get("odometer"),
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    cost: formData.get("cost"),
    workshop: formData.get("workshop"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return fail(parsed);

  const repair = await db.repairEntry.create({
    data: { ...parsed.data, vehicleId },
  });
  await saveEntryImages(formData.getAll("beforeImages"), {
    repairId: repair.id,
    kind: "BEFORE",
  });
  await saveEntryImages(formData.getAll("afterImages"), {
    repairId: repair.id,
    kind: "AFTER",
  });
  revalidatePath(`/vehicles/${vehicleId}/repairs`);
  revalidatePath(`/vehicles/${vehicleId}`);
  return { success: "Eintrag gespeichert." };
}

export async function deleteRepairAction(vehicleId: string, id: string) {
  await assertOwner(vehicleId);
  await db.repairEntry.deleteMany({ where: { id, vehicleId } });
  await db.image.deleteMany({ where: { repairId: id } });
  revalidatePath(`/vehicles/${vehicleId}/repairs`);
  revalidatePath(`/vehicles/${vehicleId}`);
}

/* ---------------- Cleaning ---------------- */

export async function createCleaningAction(
  vehicleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertOwner(vehicleId);
  const parsed = cleaningSchema.safeParse({
    date: formData.get("date"),
    odometer: formData.get("odometer"),
    type: formData.get("type"),
    cost: formData.get("cost"),
    products: formData.get("products"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return fail(parsed);

  const cleaning = await db.cleaningEntry.create({
    data: { ...parsed.data, vehicleId },
  });
  await saveEntryImages(formData.getAll("beforeImages"), {
    cleaningId: cleaning.id,
    kind: "BEFORE",
  });
  await saveEntryImages(formData.getAll("afterImages"), {
    cleaningId: cleaning.id,
    kind: "AFTER",
  });
  revalidatePath(`/vehicles/${vehicleId}/cleaning`);
  revalidatePath(`/vehicles/${vehicleId}`);
  return { success: "Eintrag gespeichert." };
}

export async function deleteCleaningAction(vehicleId: string, id: string) {
  await assertOwner(vehicleId);
  await db.cleaningEntry.deleteMany({ where: { id, vehicleId } });
  await db.image.deleteMany({ where: { cleaningId: id } });
  revalidatePath(`/vehicles/${vehicleId}/cleaning`);
  revalidatePath(`/vehicles/${vehicleId}`);
}
