"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, getVehicleAccess } from "@/lib/auth/guards";
import { saveEntryImages } from "@/lib/images";
import { canisterState, round2 } from "@/lib/canister";
import {
  fuelSchema,
  odometerSchema,
  repairSchema,
  cleaningSchema,
} from "@/lib/validation";

const EPS = 1e-6;

export type ActionState = { error?: string; success?: string };

/**
 * Allow writing entries when the current user owns the vehicle OR has been
 * granted EDITOR access. Viewers and strangers are rejected. Returns the
 * owner id so owner-scoped resources (canisters) resolve correctly even when
 * a shared editor is the one writing.
 */
async function assertCanEdit(vehicleId: string): Promise<{ ownerId: string }> {
  const user = await requireUser();
  const access = await getVehicleAccess(vehicleId, user.id);
  if (!access || access.level === "VIEWER") throw new Error("forbidden");
  return { ownerId: access.ownerId };
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
  const { ownerId } = await assertCanEdit(vehicleId);
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

  // Same station visit: one pump transaction filled the car tank AND, optionally,
  // one or more canisters — all at the single price per litre below. Parallel
  // arrays: canisterFillId[i] ⇄ canisterFillLiters[i].
  const ids = formData.getAll("canisterFillId").map(String);
  const litersRaw = formData.getAll("canisterFillLiters").map(String);
  const price = parsed.data.pricePerUnit;
  const fills: { canisterId: string; liters: number; totalCost: number }[] = [];
  for (let i = 0; i < ids.length; i++) {
    const canisterId = ids[i];
    const liters = Number(String(litersRaw[i] ?? "").replace(",", "."));
    if (!canisterId || !Number.isFinite(liters) || liters <= 0) continue;
    const canister = await db.canister.findFirst({ where: { id: canisterId, userId: ownerId } });
    if (!canister) return { error: "Kanister nicht gefunden." };
    const state = await canisterState(canisterId);
    if (state && liters > state.capacity - state.liters + EPS) {
      return { error: `„${canister.name}": nur noch ${(state.capacity - state.liters).toFixed(1)} L frei.` };
    }
    fills.push({ canisterId, liters, totalCost: round2(liters * price) });
  }

  await db.fuelEntry.create({ data: { ...parsed.data, vehicleId } });
  for (const f of fills) {
    await db.canisterFill.create({
      data: {
        canisterId: f.canisterId,
        date: parsed.data.date,
        liters: f.liters,
        pricePerUnit: price,
        totalCost: f.totalCost,
        station: parsed.data.station,
      },
    });
  }

  revalidatePath(`/vehicles/${vehicleId}/fuel`);
  revalidatePath(`/vehicles/${vehicleId}`);
  return {
    success: fills.length ? `Tankung + ${fills.length} Kanister gespeichert.` : "Tankung gespeichert.",
  };
}

export async function deleteFuelAction(vehicleId: string, id: string) {
  await assertCanEdit(vehicleId);
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
  await assertCanEdit(vehicleId);
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
  await assertCanEdit(vehicleId);
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
  await assertCanEdit(vehicleId);
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
  await assertCanEdit(vehicleId);
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
  await assertCanEdit(vehicleId);
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
  await assertCanEdit(vehicleId);
  await db.cleaningEntry.deleteMany({ where: { id, vehicleId } });
  await db.image.deleteMany({ where: { cleaningId: id } });
  revalidatePath(`/vehicles/${vehicleId}/cleaning`);
  revalidatePath(`/vehicles/${vehicleId}`);
}
