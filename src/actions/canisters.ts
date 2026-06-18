"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, getOwnedVehicle } from "@/lib/auth/guards";
import { canisterSchema, canisterFillSchema, canisterPourSchema } from "@/lib/validation";
import { canisterState, round2 } from "@/lib/canister";

export type ActionState = { error?: string; success?: string };

const EPS = 1e-6;

function fail(parsed: { error: { errors: { message: string }[] } }): ActionState {
  return { error: parsed.error.errors[0]?.message ?? "Ungültige Eingabe." };
}

async function ownCanister(canisterId: string, userId: string) {
  return db.canister.findFirst({ where: { id: canisterId, userId } });
}

function refreshFuel(vehicleId: string) {
  revalidatePath(`/vehicles/${vehicleId}/fuel`);
  revalidatePath(`/vehicles/${vehicleId}`);
}

/* ---------------- Canister CRUD ---------------- */

export async function createCanisterAction(
  vehicleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = canisterSchema.safeParse({
    name: formData.get("name"),
    capacity: formData.get("capacity"),
    fuelType: formData.get("fuelType"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return fail(parsed);
  await db.canister.create({ data: { ...parsed.data, userId: user.id } });
  refreshFuel(vehicleId);
  return { success: "Kanister angelegt." };
}

export async function deleteCanisterAction(canisterId: string, vehicleId: string) {
  const user = await requireUser();
  if (!(await ownCanister(canisterId, user.id))) return;
  // Pours keep their stored cost (FuelEntry.canisterId is set null); fills cascade.
  await db.canister.delete({ where: { id: canisterId } });
  refreshFuel(vehicleId);
}

/* ---------------- Fills (purchases into a canister) ---------------- */

export async function createCanisterFillAction(
  canisterId: string,
  vehicleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const canister = await ownCanister(canisterId, user.id);
  if (!canister) return { error: "Kanister nicht gefunden." };

  const parsed = canisterFillSchema.safeParse({
    date: formData.get("date"),
    liters: formData.get("liters"),
    pricePerUnit: formData.get("pricePerUnit"),
    totalCost: formData.get("totalCost"),
    station: formData.get("station"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return fail(parsed);

  const state = await canisterState(canisterId);
  if (state && parsed.data.liters > state.capacity - state.liters + EPS) {
    return {
      error: `Passt nicht: nur noch ${(state.capacity - state.liters).toFixed(1)} L frei (Kapazität ${state.capacity} L).`,
    };
  }

  await db.canisterFill.create({ data: { ...parsed.data, canisterId } });
  refreshFuel(vehicleId);
  return { success: "Kanister befüllt." };
}

export async function deleteCanisterFillAction(fillId: string, vehicleId: string) {
  const user = await requireUser();
  const fill = await db.canisterFill.findUnique({
    where: { id: fillId },
    include: { canister: { select: { userId: true } } },
  });
  if (!fill || fill.canister.userId !== user.id) return;
  await db.canisterFill.delete({ where: { id: fillId } });
  refreshFuel(vehicleId);
}

/* ---------------- Pour (canister → car) ---------------- */

export async function createCanisterPourAction(
  vehicleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!(await getOwnedVehicle(vehicleId, user.id))) return { error: "Fahrzeug nicht gefunden." };

  const canisterId = String(formData.get("canisterId") ?? "");
  const canister = await ownCanister(canisterId, user.id);
  if (!canister) return { error: "Bitte einen Kanister wählen." };

  const parsed = canisterPourSchema.safeParse({
    date: formData.get("date"),
    odometer: formData.get("odometer"),
    amount: formData.get("amount"),
    isFullTank: formData.get("isFullTank") === "on" || formData.get("isFullTank") === "true",
    notes: formData.get("notes"),
  });
  if (!parsed.success) return fail(parsed);

  const state = await canisterState(canisterId);
  if (!state || state.liters <= EPS) return { error: "Kanister ist leer." };
  if (parsed.data.amount > state.liters + EPS) {
    return { error: `Nur ${state.liters.toFixed(2)} L im Kanister verfügbar.` };
  }

  const pricePerUnit = round2(state.avgPrice);
  const totalCost = round2(parsed.data.amount * state.avgPrice);
  await db.fuelEntry.create({
    data: {
      vehicleId,
      kind: "CANISTER",
      canisterId,
      date: parsed.data.date,
      odometer: parsed.data.odometer,
      amount: parsed.data.amount,
      isFullTank: parsed.data.isFullTank,
      notes: parsed.data.notes,
      pricePerUnit,
      totalCost,
    },
  });
  refreshFuel(vehicleId);
  return { success: `Aus Kanister nachgefüllt (${totalCost.toFixed(2)} €).` };
}
