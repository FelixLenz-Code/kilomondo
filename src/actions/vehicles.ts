"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, getOwnedVehicle } from "@/lib/auth/guards";
import { vehicleSchema } from "@/lib/validation";
import { saveDataUrlImage, resolveImageUpdate } from "@/lib/images";

export type ActionState = { error?: string };

function parseVehicle(formData: FormData) {
  return vehicleSchema.safeParse({
    name: formData.get("name"),
    make: formData.get("make"),
    model: formData.get("model"),
    year: formData.get("year"),
    licensePlate: formData.get("licensePlate"),
    vin: formData.get("vin"),
    fuelType: formData.get("fuelType"),
    color: formData.get("color"),
    initialOdometer: formData.get("initialOdometer"),
  });
}

export async function createVehicleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseVehicle(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Ungültige Eingabe." };
  }

  const coverImageId = await saveDataUrlImage(formData.get("coverImage"));
  const vehicle = await db.vehicle.create({
    data: { ...parsed.data, coverImageId, userId: user.id },
  });
  revalidatePath("/");
  redirect(`/vehicles/${vehicle.id}`);
}

export async function updateVehicleAction(
  vehicleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const owned = await getOwnedVehicle(vehicleId, user.id);
  if (!owned) return { error: "Fahrzeug nicht gefunden." };

  const parsed = parseVehicle(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Ungültige Eingabe." };
  }

  const coverImageId = await resolveImageUpdate(
    formData.get("coverImage"),
    owned.coverImageId
  );
  await db.vehicle.update({
    where: { id: vehicleId },
    data: { ...parsed.data, coverImageId },
  });
  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/");
  redirect(`/vehicles/${vehicleId}`);
}

export async function deleteVehicleAction(vehicleId: string): Promise<void> {
  const user = await requireUser();
  const owned = await getOwnedVehicle(vehicleId, user.id);
  if (!owned) redirect("/");

  // Collect and remove all images belonging to this vehicle.
  const [repairs, cleanings] = await Promise.all([
    db.repairEntry.findMany({ where: { vehicleId }, select: { id: true } }),
    db.cleaningEntry.findMany({ where: { vehicleId }, select: { id: true } }),
  ]);

  await db.vehicle.delete({ where: { id: vehicleId } });
  await db.image.deleteMany({
    where: {
      OR: [
        { id: owned.coverImageId ?? "" },
        { repairId: { in: repairs.map((r) => r.id) } },
        { cleaningId: { in: cleanings.map((c) => c.id) } },
      ],
    },
  });
  revalidatePath("/");
  redirect("/");
}
