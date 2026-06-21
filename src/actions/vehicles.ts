"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/lib/db";
import { requireUser, getOwnedVehicle } from "@/lib/auth/guards";
import { vehicleSchema } from "@/lib/validation";
import { saveDataUrlImage, resolveImageUpdate } from "@/lib/images";
import { readGlbUpload, renderVehicleAnimationJob } from "@/lib/animation";
import { importVehicleZip } from "@/lib/vehicle-transfer";
import { ensureLogReminder } from "@/lib/reminder-suggestions";

export type ActionState = { error?: string };

// Safety cap; the practical limit is the server action body size (next.config).
const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

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
    adblueTracking:
      formData.get("adblueTracking") === "on" || formData.get("adblueTracking") === "true",
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

  let glb: Buffer | null;
  try {
    glb = await readGlbUpload(formData.get("model3d"));
  } catch (e) {
    return { error: (e as Error).message };
  }

  const coverImageId = await saveDataUrlImage(formData.get("coverImage"));
  const vehicle = await db.vehicle.create({
    data: {
      ...parsed.data,
      coverImageId,
      userId: user.id,
      animationStatus: glb ? "PENDING" : "NONE",
    },
  });
  if (glb) {
    const buf = glb;
    after(() => renderVehicleAnimationJob(vehicle.id, buf, { videoId: null, posterId: null }));
  }
  // Activate the default "don't forget to log" reminder for the new vehicle.
  await ensureLogReminder(vehicle.id);
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

  let glb: Buffer | null;
  try {
    glb = await readGlbUpload(formData.get("model3d"));
  } catch (e) {
    return { error: (e as Error).message };
  }

  const coverImageId = await resolveImageUpdate(
    formData.get("coverImage"),
    owned.coverImageId
  );
  await db.vehicle.update({
    where: { id: vehicleId },
    data: {
      ...parsed.data,
      coverImageId,
      ...(glb ? { animationStatus: "PENDING" } : {}),
    },
  });
  if (glb) {
    const buf = glb;
    after(() =>
      renderVehicleAnimationJob(vehicleId, buf, {
        videoId: owned.animationVideoId,
        posterId: owned.animationPosterId,
      })
    );
  }
  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/");
  redirect(`/vehicles/${vehicleId}`);
}

export async function importVehicleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const file = formData.get("archive");
  if (!file || typeof file === "string" || file.size === 0) {
    return { error: "Bitte eine Export-ZIP auswählen." };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { error: "Datei zu groß (max. 100 MB)." };
  }

  let vehicleId: string;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    ({ vehicleId } = await importVehicleZip(buf, user.id));
  } catch (e) {
    return { error: (e as Error).message || "Import fehlgeschlagen." };
  }

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

  const repairIds = repairs.map((r) => r.id);
  await db.vehicle.delete({ where: { id: vehicleId } });
  await db.image.deleteMany({
    where: {
      OR: [
        { id: { in: [owned.coverImageId, owned.animationVideoId, owned.animationPosterId].filter((x): x is string => !!x) } },
        { repairId: { in: repairIds } },
        { cleaningId: { in: cleanings.map((c) => c.id) } },
      ],
    },
  });
  // Attachments have no FK/cascade — remove the repairs' attachments explicitly
  // so they don't linger in the DB (and remain fetchable) after deletion.
  await db.attachment.deleteMany({ where: { repairId: { in: repairIds } } });
  revalidatePath("/");
  redirect("/");
}
