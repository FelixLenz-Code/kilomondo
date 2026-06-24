"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, getVehicleAccess } from "@/lib/auth/guards";
import { chargingSchema } from "@/lib/validation";
import { resolveChargingCost } from "@/lib/charging";

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
  revalidatePath(`/vehicles/${vehicleId}/charging`);
  revalidatePath(`/vehicles/${vehicleId}`);
}

function parse(formData: FormData) {
  return chargingSchema.safeParse({
    date: formData.get("date"),
    odometer: formData.get("odometer"),
    energyKwh: formData.get("energyKwh"),
    pricePerKwh: formData.get("pricePerKwh"),
    totalCost: formData.get("totalCost"),
    location: formData.get("location"),
    provider: formData.get("provider"),
    notes: formData.get("notes"),
  });
}

export async function createChargingAction(
  vehicleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await canEdit(vehicleId))) return { error: "Keine Berechtigung." };
  const parsed = parse(formData);
  if (!parsed.success) return fail(parsed);
  const { pricePerKwh, totalCost, ...rest } = parsed.data;
  const cost = resolveChargingCost(rest.energyKwh, pricePerKwh, totalCost);

  await db.chargingSession.create({
    data: { ...rest, ...cost, vehicleId },
  });
  refresh(vehicleId);
  return { success: "Ladevorgang gespeichert." };
}

export async function updateChargingAction(
  vehicleId: string,
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await canEdit(vehicleId))) return { error: "Keine Berechtigung." };
  const parsed = parse(formData);
  if (!parsed.success) return fail(parsed);
  const { pricePerKwh, totalCost, ...rest } = parsed.data;
  const cost = resolveChargingCost(rest.energyKwh, pricePerKwh, totalCost);

  const { count } = await db.chargingSession.updateMany({
    where: { id, vehicleId },
    data: { ...rest, ...cost, odometer: rest.odometer ?? null },
  });
  if (count === 0) return { error: "Ladevorgang nicht gefunden." };
  refresh(vehicleId);
  return { success: "Ladevorgang aktualisiert." };
}

export async function deleteChargingAction(vehicleId: string, id: string) {
  if (!(await canEdit(vehicleId))) return;
  await db.chargingSession.deleteMany({ where: { id, vehicleId } });
  refresh(vehicleId);
}
