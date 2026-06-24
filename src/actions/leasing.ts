"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, getVehicleAccess } from "@/lib/auth/guards";
import { leasingSchema } from "@/lib/validation";

export type ActionState = { error?: string; success?: string };

function fail(parsed: { error: { errors: { message: string }[] } }): ActionState {
  return { error: parsed.error.errors[0]?.message ?? "Ungültige Eingabe." };
}

async function canEdit(vehicleId: string): Promise<boolean> {
  const user = await requireUser();
  const access = await getVehicleAccess(vehicleId, user.id);
  return access != null && access.level !== "VIEWER";
}

export async function upsertLeasingAction(
  vehicleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await canEdit(vehicleId))) return { error: "Keine Berechtigung." };
  const parsed = leasingSchema.safeParse({
    provider: formData.get("provider"),
    monthlyRate: formData.get("monthlyRate"),
    downPayment: formData.get("downPayment"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    startOdometer: formData.get("startOdometer"),
    annualKmLimit: formData.get("annualKmLimit"),
    excessKmCost: formData.get("excessKmCost"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return fail(parsed);

  await db.leasingContract.upsert({
    where: { vehicleId },
    create: { ...parsed.data, vehicleId },
    update: parsed.data,
  });
  revalidatePath(`/vehicles/${vehicleId}/settings`);
  revalidatePath(`/vehicles/${vehicleId}`);
  return { success: "Leasing-Daten gespeichert." };
}

export async function deleteLeasingAction(vehicleId: string) {
  if (!(await canEdit(vehicleId))) return;
  await db.leasingContract.deleteMany({ where: { vehicleId } });
  revalidatePath(`/vehicles/${vehicleId}/settings`);
  revalidatePath(`/vehicles/${vehicleId}`);
}
