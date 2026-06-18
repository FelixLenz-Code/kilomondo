import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageGallery, type GalleryImage } from "@/components/image-gallery";
import { formatDate } from "@/lib/utils";

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const vehicle = await db.vehicle.findFirst({
    where: { id, userId: user.id },
    include: {
      repairEntries: { select: { id: true, title: true } },
      cleaningEntries: { select: { id: true, date: true } },
    },
  });
  if (!vehicle) return null;

  const repairTitle = new Map(vehicle.repairEntries.map((r) => [r.id, r.title]));
  const cleaningDate = new Map(vehicle.cleaningEntries.map((c) => [c.id, c.date]));
  const repairIds = vehicle.repairEntries.map((r) => r.id);
  const cleaningIds = vehicle.cleaningEntries.map((c) => c.id);

  // Every user-uploaded image tied to this vehicle: the cover plus all
  // before/after photos from repair and cleaning entries. The animation
  // video/poster are generated (not uploaded), so they're intentionally absent
  // here — they aren't linked by cover/repair/cleaning.
  const or = [
    ...(vehicle.coverImageId ? [{ id: vehicle.coverImageId }] : []),
    ...(repairIds.length ? [{ repairId: { in: repairIds } }] : []),
    ...(cleaningIds.length ? [{ cleaningId: { in: cleaningIds } }] : []),
  ];
  const rows = or.length
    ? await db.image.findMany({
        where: { OR: or },
        select: {
          id: true,
          mimeType: true,
          repairId: true,
          cleaningId: true,
          kind: true,
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const kindLabel = (k: string | null) =>
    k === "BEFORE" ? "Vorher" : k === "AFTER" ? "Nachher" : "";

  const images: GalleryImage[] = rows
    .filter((im) => im.mimeType.startsWith("image/"))
    .map((im) => {
      let label = "Bild";
      if (im.id === vehicle.coverImageId) {
        label = "Titelbild";
      } else if (im.repairId) {
        label = [repairTitle.get(im.repairId) ?? "Reparatur", kindLabel(im.kind)]
          .filter(Boolean)
          .join(" · ");
      } else if (im.cleaningId) {
        const d = cleaningDate.get(im.cleaningId);
        label = ["Pflege", d ? formatDate(d) : null, kindLabel(im.kind)]
          .filter(Boolean)
          .join(" · ");
      }
      return { id: im.id, mimeType: im.mimeType, label };
    });

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Galerie ({images.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <ImageGallery images={images} vehicleName={vehicle.name} />
      </CardContent>
    </Card>
  );
}
