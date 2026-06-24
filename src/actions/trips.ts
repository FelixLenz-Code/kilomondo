"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, getVehicleAccess } from "@/lib/auth/guards";
import { tripSchema } from "@/lib/validation";

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
  revalidatePath(`/vehicles/${vehicleId}/trips`);
  revalidatePath(`/vehicles/${vehicleId}`);
}

function parse(formData: FormData) {
  return tripSchema.safeParse({
    date: formData.get("date"),
    startOdometer: formData.get("startOdometer"),
    endOdometer: formData.get("endOdometer"),
    purpose: formData.get("purpose"),
    startLocation: formData.get("startLocation"),
    endLocation: formData.get("endLocation"),
    description: formData.get("description"),
  });
}

export async function createTripAction(
  vehicleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await canEdit(vehicleId))) return { error: "Keine Berechtigung." };
  const parsed = parse(formData);
  if (!parsed.success) return fail(parsed);

  await db.trip.create({ data: { ...parsed.data, vehicleId } });
  refresh(vehicleId);
  return { success: "Fahrt gespeichert." };
}

export async function updateTripAction(
  vehicleId: string,
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await canEdit(vehicleId))) return { error: "Keine Berechtigung." };
  const parsed = parse(formData);
  if (!parsed.success) return fail(parsed);

  const { count } = await db.trip.updateMany({
    where: { id, vehicleId },
    data: parsed.data,
  });
  if (count === 0) return { error: "Fahrt nicht gefunden." };
  refresh(vehicleId);
  return { success: "Fahrt aktualisiert." };
}

export async function deleteTripAction(vehicleId: string, id: string) {
  if (!(await canEdit(vehicleId))) return;
  await db.trip.deleteMany({ where: { id, vehicleId } });
  refresh(vehicleId);
}
