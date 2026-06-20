import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getVehicleAccess } from "@/lib/auth/guards";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const attachment = await db.attachment.findUnique({ where: { id } });
  if (!attachment) return new Response("Not found", { status: 404 });

  // Authorize: resolve the owning vehicle via the repair entry and check access.
  // 404 (not 403) so ids of inaccessible attachments aren't confirmed to exist.
  if (!attachment.repairId) return new Response("Not found", { status: 404 });
  const repair = await db.repairEntry.findUnique({
    where: { id: attachment.repairId },
    select: { vehicleId: true },
  });
  if (!repair) return new Response("Not found", { status: 404 });
  const access = await getVehicleAccess(repair.vehicleId, user.id);
  if (!access) return new Response("Not found", { status: 404 });

  // RFC 5987 encoding so non-ASCII file names survive the header.
  const encodedName = encodeURIComponent(attachment.fileName);
  return new Response(new Uint8Array(attachment.data), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodedName}`,
      // "sandbox" neutralizes any script embedded in a PDF when viewed inline.
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
