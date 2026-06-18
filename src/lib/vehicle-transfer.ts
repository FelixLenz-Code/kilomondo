import "server-only";
import JSZip from "jszip";
import { z } from "zod";
import { db } from "@/lib/db";

/**
 * Vehicle export/import as a self-contained ZIP:
 *
 *   manifest.json          all structured data + references to the files below
 *   files/cover.<ext>      cover image
 *   files/animation-*.*    3D intro video + poster (if rendered)
 *   files/repair-*.* …     before/after photos per repair / cleaning entry
 *
 * Import recreates the vehicle (with fresh ids) for the importing user, so an
 * export from one account/server can be restored on another.
 */

const FORMAT = "carlog-vehicle";
const VERSION = 2;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "video/mp4": "mp4",
};
const extFor = (mime: string) => EXT[mime] ?? "bin";

/** Bytes column wants an ArrayBuffer-backed Uint8Array. */
function toBytes(buf: Buffer): Uint8Array<ArrayBuffer> {
  const a = new Uint8Array(buf.length);
  a.set(buf);
  return a;
}

function slugify(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "fahrzeug"
  );
}

// ---------------- export ----------------

export async function exportVehicleZip(
  vehicleId: string,
  userId: string
): Promise<{ filename: string; buffer: Buffer } | null> {
  const v = await db.vehicle.findFirst({
    where: { id: vehicleId, userId },
    include: {
      fuelEntries: { orderBy: { date: "asc" } },
      odometerEntries: { orderBy: { date: "asc" } },
      repairEntries: { orderBy: { date: "asc" } },
      cleaningEntries: { orderBy: { date: "asc" } },
    },
  });
  if (!v) return null;

  const zip = new JSZip();
  const dir = zip.folder("files")!;
  // Images/video are already compressed — store them uncompressed (fast).
  const store = { compression: "STORE" as const };

  const putImage = async (id: string | null, baseName: string) => {
    if (!id) return null;
    const img = await db.image.findUnique({ where: { id } });
    if (!img) return null;
    const file = `${baseName}.${extFor(img.mimeType)}`;
    dir.file(file, Buffer.from(img.data), store);
    return { file: `files/${file}`, mimeType: img.mimeType };
  };

  const cover = await putImage(v.coverImageId, "cover");

  let animation: {
    status: string;
    video: { file: string; mimeType: string } | null;
    poster: { file: string; mimeType: string } | null;
  } | null = null;
  if (v.animationVideoId || v.animationPosterId) {
    const video = await putImage(v.animationVideoId, "animation-video");
    const poster = await putImage(v.animationPosterId, "animation-poster");
    if (video || poster) animation = { status: v.animationStatus, video, poster };
  }

  const repairImages = v.repairEntries.length
    ? await db.image.findMany({
        where: { repairId: { in: v.repairEntries.map((r) => r.id) } },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const cleaningImages = v.cleaningEntries.length
    ? await db.image.findMany({
        where: { cleaningId: { in: v.cleaningEntries.map((c) => c.id) } },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const repairEntries = v.repairEntries.map((r, i) => {
    const images = repairImages
      .filter((im) => im.repairId === r.id)
      .map((im, n) => {
        const file = `repair-${i}-${(im.kind ?? "after").toLowerCase()}-${n}.${extFor(im.mimeType)}`;
        dir.file(file, Buffer.from(im.data), store);
        return { kind: im.kind, file: `files/${file}`, mimeType: im.mimeType };
      });
    return {
      date: r.date.toISOString(),
      odometer: r.odometer,
      title: r.title,
      description: r.description,
      category: r.category,
      cost: r.cost,
      workshop: r.workshop,
      notes: r.notes,
      images,
    };
  });

  const cleaningEntries = v.cleaningEntries.map((c, i) => {
    const images = cleaningImages
      .filter((im) => im.cleaningId === c.id)
      .map((im, n) => {
        const file = `cleaning-${i}-${(im.kind ?? "after").toLowerCase()}-${n}.${extFor(im.mimeType)}`;
        dir.file(file, Buffer.from(im.data), store);
        return { kind: im.kind, file: `files/${file}`, mimeType: im.mimeType };
      });
    return {
      date: c.date.toISOString(),
      odometer: c.odometer,
      type: c.type,
      cost: c.cost,
      products: c.products,
      notes: c.notes,
      images,
    };
  });

  // Canisters this vehicle's pours drew from, plus their fills, so an imported
  // vehicle keeps full canister context (contents/value derivation).
  const canisterIds = [
    ...new Set(
      v.fuelEntries
        .filter((f) => f.kind === "CANISTER" && f.canisterId)
        .map((f) => f.canisterId as string)
    ),
  ];
  const canisterRows = canisterIds.length
    ? await db.canister.findMany({ where: { id: { in: canisterIds } } })
    : [];
  const canisterFills = canisterIds.length
    ? await db.canisterFill.findMany({ where: { canisterId: { in: canisterIds } }, orderBy: { date: "asc" } })
    : [];
  const canisters = canisterRows.map((c) => ({
    key: c.id,
    name: c.name,
    capacity: c.capacity,
    fuelType: c.fuelType,
    notes: c.notes,
    fills: canisterFills
      .filter((f) => f.canisterId === c.id)
      .map((f) => ({
        date: f.date.toISOString(),
        liters: f.liters,
        pricePerUnit: f.pricePerUnit,
        totalCost: f.totalCost,
        station: f.station,
        notes: f.notes,
      })),
  }));

  const manifest = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    vehicle: {
      name: v.name,
      make: v.make,
      model: v.model,
      year: v.year,
      licensePlate: v.licensePlate,
      vin: v.vin,
      fuelType: v.fuelType,
      color: v.color,
      initialOdometer: v.initialOdometer,
    },
    cover,
    animation,
    canisters,
    fuelEntries: v.fuelEntries.map((f) => ({
      date: f.date.toISOString(),
      odometer: f.odometer,
      amount: f.amount,
      pricePerUnit: f.pricePerUnit,
      totalCost: f.totalCost,
      isFullTank: f.isFullTank,
      station: f.station,
      notes: f.notes,
      kind: f.kind,
      canister: f.canisterId ?? null,
    })),
    odometerEntries: v.odometerEntries.map((o) => ({
      date: o.date.toISOString(),
      odometer: o.odometer,
      note: o.note,
    })),
    repairEntries,
    cleaningEntries,
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
  return { filename: `carlog-${slugify(v.name)}.zip`, buffer };
}

// ---------------- import ----------------

const imageRef = z.object({ file: z.string(), mimeType: z.string() });
const kind = z.enum(["BEFORE", "AFTER"]).nullish();
const num = z.number().finite();

const manifestSchema = z.object({
  format: z.literal(FORMAT),
  version: z.number(),
  vehicle: z.object({
    name: z.string().min(1).max(120),
    make: z.string().nullish(),
    model: z.string().nullish(),
    year: z.number().int().nullish(),
    licensePlate: z.string().nullish(),
    vin: z.string().nullish(),
    fuelType: z.enum(["PETROL", "DIESEL", "ELECTRIC", "HYBRID", "LPG"]),
    color: z.string().nullish(),
    initialOdometer: z.number().int().min(0).default(0),
  }),
  cover: imageRef.nullish(),
  animation: z
    .object({ status: z.string().optional(), video: imageRef.nullish(), poster: imageRef.nullish() })
    .nullish(),
  canisters: z
    .array(
      z.object({
        key: z.string(),
        name: z.string().min(1).max(120),
        capacity: num.positive(),
        fuelType: z.enum(["PETROL", "DIESEL", "ELECTRIC", "HYBRID", "LPG"]).nullish(),
        notes: z.string().nullish(),
        fills: z
          .array(
            z.object({
              date: z.string(),
              liters: num,
              pricePerUnit: num,
              totalCost: num,
              station: z.string().nullish(),
              notes: z.string().nullish(),
            })
          )
          .default([]),
      })
    )
    .default([]),
  fuelEntries: z
    .array(
      z.object({
        date: z.string(),
        odometer: num.int(),
        amount: num,
        pricePerUnit: num,
        totalCost: num,
        isFullTank: z.boolean().default(true),
        station: z.string().nullish(),
        notes: z.string().nullish(),
        kind: z.enum(["CAR", "CANISTER"]).default("CAR"),
        canister: z.string().nullish(),
      })
    )
    .default([]),
  odometerEntries: z
    .array(z.object({ date: z.string(), odometer: num.int(), note: z.string().nullish() }))
    .default([]),
  repairEntries: z
    .array(
      z.object({
        date: z.string(),
        odometer: num.int().nullish(),
        title: z.string().min(1).max(160),
        description: z.string().nullish(),
        category: z.enum(["REPAIR", "SERVICE", "INSPECTION", "TIRES", "OTHER"]).default("REPAIR"),
        cost: num.default(0),
        workshop: z.string().nullish(),
        notes: z.string().nullish(),
        images: z.array(imageRef.extend({ kind })).default([]),
      })
    )
    .default([]),
  cleaningEntries: z
    .array(
      z.object({
        date: z.string(),
        odometer: num.int().nullish(),
        type: z.enum(["INTERIOR", "EXTERIOR", "FULL"]).default("FULL"),
        cost: num.default(0),
        products: z.string().nullish(),
        notes: z.string().nullish(),
        images: z.array(imageRef.extend({ kind })).default([]),
      })
    )
    .default([]),
});

const ALLOWED_MIME = /^(image\/(jpeg|jpg|png|webp|gif|avif)|video\/mp4)$/;

/** Recreate a vehicle (and all its data, images & video) from an export ZIP. */
export async function importVehicleZip(
  buf: Buffer,
  userId: string
): Promise<{ vehicleId: string }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    throw new Error("Datei ist kein gültiges ZIP-Archiv.");
  }
  const manifestEntry = zip.file("manifest.json");
  if (!manifestEntry) throw new Error("Kein Car-Log-Export (manifest.json fehlt).");

  let manifest: z.infer<typeof manifestSchema>;
  try {
    manifest = manifestSchema.parse(JSON.parse(await manifestEntry.async("string")));
  } catch {
    throw new Error("Manifest ist beschädigt oder hat ein unbekanntes Format.");
  }

  const readBytes = async (ref: { file: string; mimeType: string } | null | undefined) => {
    if (!ref) return null;
    if (!ALLOWED_MIME.test(ref.mimeType)) return null;
    const f = zip.file(ref.file);
    if (!f) return null;
    const data = await f.async("nodebuffer");
    if (data.length === 0) return null;
    return { mimeType: ref.mimeType, data: toBytes(data) };
  };
  const createImage = async (
    ref: { file: string; mimeType: string } | null | undefined,
    link?: { repairId?: string; cleaningId?: string; kind?: "BEFORE" | "AFTER" | null }
  ) => {
    const b = await readBytes(ref);
    if (!b) return null;
    const img = await db.image.create({
      data: {
        mimeType: b.mimeType,
        data: b.data,
        repairId: link?.repairId,
        cleaningId: link?.cleaningId,
        kind: link?.kind ?? undefined,
      },
    });
    return img.id;
  };

  const coverImageId = await createImage(manifest.cover);
  let animationVideoId: string | null = null;
  let animationPosterId: string | null = null;
  let animationStatus: "NONE" | "READY" = "NONE";
  if (manifest.animation) {
    animationVideoId = await createImage(manifest.animation.video);
    animationPosterId = await createImage(manifest.animation.poster);
    if (animationVideoId) animationStatus = "READY";
  }

  const vehicle = await db.vehicle.create({
    data: {
      userId,
      name: manifest.vehicle.name,
      make: manifest.vehicle.make ?? null,
      model: manifest.vehicle.model ?? null,
      year: manifest.vehicle.year ?? null,
      licensePlate: manifest.vehicle.licensePlate ?? null,
      vin: manifest.vehicle.vin ?? null,
      fuelType: manifest.vehicle.fuelType,
      color: manifest.vehicle.color ?? null,
      initialOdometer: manifest.vehicle.initialOdometer,
      coverImageId,
      animationVideoId,
      animationPosterId,
      animationStatus,
    },
  });

  // Recreate referenced canisters (user-level) + their fills, mapping the
  // export keys to fresh ids so the pours below can link to them.
  const canisterIdByKey = new Map<string, string>();
  for (const c of manifest.canisters) {
    const created = await db.canister.create({
      data: {
        userId,
        name: c.name,
        capacity: c.capacity,
        fuelType: c.fuelType ?? null,
        notes: c.notes ?? null,
      },
    });
    canisterIdByKey.set(c.key, created.id);
    if (c.fills.length) {
      await db.canisterFill.createMany({
        data: c.fills.map((f) => ({
          canisterId: created.id,
          date: new Date(f.date),
          liters: f.liters,
          pricePerUnit: f.pricePerUnit,
          totalCost: f.totalCost,
          station: f.station ?? null,
          notes: f.notes ?? null,
        })),
      });
    }
  }

  if (manifest.fuelEntries.length) {
    await db.fuelEntry.createMany({
      data: manifest.fuelEntries.map((f) => ({
        vehicleId: vehicle.id,
        date: new Date(f.date),
        odometer: f.odometer,
        amount: f.amount,
        pricePerUnit: f.pricePerUnit,
        totalCost: f.totalCost,
        isFullTank: f.isFullTank,
        station: f.station ?? null,
        notes: f.notes ?? null,
        kind: f.kind,
        canisterId: f.canister ? canisterIdByKey.get(f.canister) ?? null : null,
      })),
    });
  }
  if (manifest.odometerEntries.length) {
    await db.odometerEntry.createMany({
      data: manifest.odometerEntries.map((o) => ({
        vehicleId: vehicle.id,
        date: new Date(o.date),
        odometer: o.odometer,
        note: o.note ?? null,
      })),
    });
  }

  for (const r of manifest.repairEntries) {
    const rec = await db.repairEntry.create({
      data: {
        vehicleId: vehicle.id,
        date: new Date(r.date),
        odometer: r.odometer ?? null,
        title: r.title,
        description: r.description ?? null,
        category: r.category,
        cost: r.cost,
        workshop: r.workshop ?? null,
        notes: r.notes ?? null,
      },
    });
    for (const im of r.images) {
      await createImage(im, { repairId: rec.id, kind: im.kind });
    }
  }

  for (const c of manifest.cleaningEntries) {
    const rec = await db.cleaningEntry.create({
      data: {
        vehicleId: vehicle.id,
        date: new Date(c.date),
        odometer: c.odometer ?? null,
        type: c.type,
        cost: c.cost,
        products: c.products ?? null,
        notes: c.notes ?? null,
      },
    });
    for (const im of c.images) {
      await createImage(im, { cleaningId: rec.id, kind: im.kind });
    }
  }

  return { vehicleId: vehicle.id };
}
