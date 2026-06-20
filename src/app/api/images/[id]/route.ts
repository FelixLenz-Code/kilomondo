import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getVehicleAccess } from "@/lib/auth/guards";

/**
 * Resolve which vehicle an image belongs to: a repair/cleaning gallery image
 * via its entry, otherwise a cover or animation image referenced by a vehicle.
 * Returns null for images that aren't linked to any vehicle (deny by default).
 */
async function vehicleIdForImage(image: {
  id: string;
  repairId: string | null;
  cleaningId: string | null;
}): Promise<string | null> {
  if (image.repairId) {
    const r = await db.repairEntry.findUnique({
      where: { id: image.repairId },
      select: { vehicleId: true },
    });
    return r?.vehicleId ?? null;
  }
  if (image.cleaningId) {
    const c = await db.cleaningEntry.findUnique({
      where: { id: image.cleaningId },
      select: { vehicleId: true },
    });
    return c?.vehicleId ?? null;
  }
  const v = await db.vehicle.findFirst({
    where: {
      OR: [
        { coverImageId: image.id },
        { animationVideoId: image.id },
        { animationPosterId: image.id },
      ],
    },
    select: { id: true },
  });
  return v?.id ?? null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const image = await db.image.findUnique({ where: { id } });
  if (!image) return new Response("Not found", { status: 404 });

  // Authorize: the requester must have access to the owning vehicle. Use 404
  // (not 403) so ids of inaccessible images aren't confirmed to exist.
  const vehicleId = await vehicleIdForImage(image);
  if (!vehicleId) return new Response("Not found", { status: 404 });
  const access = await getVehicleAccess(vehicleId, user.id);
  if (!access) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mimeType,
      // Defense in depth: if ever opened as a top-level document, "sandbox"
      // neutralizes script execution (e.g. inside an SVG) without blocking the
      // browser's image/video viewer; nosniff stops content-type guessing.
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
