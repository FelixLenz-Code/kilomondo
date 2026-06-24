"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, getVehicleAccess } from "@/lib/auth/guards";
import { expenseSchema } from "@/lib/validation";

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
  revalidatePath(`/vehicles/${vehicleId}/costs`);
  revalidatePath(`/vehicles/${vehicleId}`);
}

function parse(formData: FormData) {
  return expenseSchema.safeParse({
    date: formData.get("date"),
    category: formData.get("category"),
    title: formData.get("title"),
    amount: formData.get("amount"),
    notes: formData.get("notes"),
  });
}

export async function createExpenseAction(
  vehicleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await canEdit(vehicleId))) return { error: "Keine Berechtigung." };
  const parsed = parse(formData);
  if (!parsed.success) return fail(parsed);

  await db.expense.create({ data: { ...parsed.data, vehicleId } });
  refresh(vehicleId);
  return { success: "Kosten gespeichert." };
}

export async function updateExpenseAction(
  vehicleId: string,
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await canEdit(vehicleId))) return { error: "Keine Berechtigung." };
  const parsed = parse(formData);
  if (!parsed.success) return fail(parsed);

  const { count } = await db.expense.updateMany({
    where: { id, vehicleId },
    data: parsed.data,
  });
  if (count === 0) return { error: "Eintrag nicht gefunden." };
  refresh(vehicleId);
  return { success: "Kosten aktualisiert." };
}

export async function deleteExpenseAction(vehicleId: string, id: string) {
  if (!(await canEdit(vehicleId))) return;
  await db.expense.deleteMany({ where: { id, vehicleId } });
  refresh(vehicleId);
}
