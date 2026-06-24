import "server-only";
import JSZip from "jszip";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureLogReminder } from "@/lib/reminder-suggestions";

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
// v4 adds Attachment file bytes (document scans + repair invoices) to the ZIP.
const VERSION = 4;

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

// Attachments keep their original file name, so prefer its extension; fall back
// to a mime-based one. Used only for the (cosmetic) path inside the ZIP.
const ATT_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/heic": "heic",
};
function attExtFor(fileName: string, mime: string): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(fileName);
  return m ? m[1].toLowerCase() : ATT_EXT[mime] ?? "bin";
}

// Mirrors the upload whitelist in lib/attachments.ts.
const ATT_ALLOWED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
]);
const ATT_MAX_BYTES = 20 * 1024 * 1024;

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
      tireSets: { orderBy: { createdAt: "asc" } },
      tireChanges: { orderBy: { date: "asc" } },
      documents: { orderBy: { createdAt: "asc" } },
      trips: { orderBy: { date: "asc" } },
      chargingSessions: { orderBy: { date: "asc" } },
      leasing: true,
      expenses: { orderBy: { date: "asc" } },
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

  // File attachments (PDFs / photos of invoices, document scans) live in the
  // Attachment model, linked by repairId or documentId.
  const repairAttachments = v.repairEntries.length
    ? await db.attachment.findMany({
        where: { repairId: { in: v.repairEntries.map((r) => r.id) } },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const documentAttachments = v.documents.length
    ? await db.attachment.findMany({
        where: { documentId: { in: v.documents.map((d) => d.id) } },
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
    const attachments = repairAttachments
      .filter((a) => a.repairId === r.id)
      .map((a, n) => {
        const file = `repair-att-${i}-${n}.${attExtFor(a.fileName, a.mimeType)}`;
        dir.file(file, Buffer.from(a.data), store);
        return { file: `files/${file}`, fileName: a.fileName, mimeType: a.mimeType };
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
      attachments,
    };
  });

  const documents = v.documents.map((d, i) => {
    const attachments = documentAttachments
      .filter((a) => a.documentId === d.id)
      .map((a, n) => {
        const file = `doc-att-${i}-${n}.${attExtFor(a.fileName, a.mimeType)}`;
        dir.file(file, Buffer.from(a.data), store);
        return { file: `files/${file}`, fileName: a.fileName, mimeType: a.mimeType };
      });
    return {
      title: d.title,
      category: d.category,
      issueDate: d.issueDate ? d.issueDate.toISOString() : null,
      expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
      notes: d.notes,
      attachments,
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
      adblueTracking: v.adblueTracking,
      tireTracking: v.tireTracking,
      tripLogging: v.tripLogging,
      leasingTracking: v.leasingTracking,
      evTracking: v.evTracking,
    },
    cover,
    animation,
    canisters,
    tireSets: v.tireSets.map((t) => ({
      key: t.id,
      name: t.name,
      season: t.season,
      dimension: t.dimension,
      brand: t.brand,
      purchaseDate: t.purchaseDate ? t.purchaseDate.toISOString() : null,
      treadDepthMm: t.treadDepthMm,
      storageLocation: t.storageLocation,
      retired: t.retired,
      notes: t.notes,
    })),
    tireChanges: v.tireChanges.map((c) => ({
      tireSet: c.tireSetId,
      date: c.date.toISOString(),
      odometer: c.odometer,
      notes: c.notes,
    })),
    // Document metadata + their file attachments (scans/PDFs), bytes stored in
    // the ZIP under files/doc-att-*.
    documents,
    trips: v.trips.map((t) => ({
      date: t.date.toISOString(),
      startOdometer: t.startOdometer,
      endOdometer: t.endOdometer,
      purpose: t.purpose,
      startLocation: t.startLocation,
      endLocation: t.endLocation,
      description: t.description,
    })),
    chargingSessions: v.chargingSessions.map((c) => ({
      date: c.date.toISOString(),
      odometer: c.odometer,
      energyKwh: c.energyKwh,
      pricePerKwh: c.pricePerKwh,
      totalCost: c.totalCost,
      location: c.location,
      provider: c.provider,
      notes: c.notes,
    })),
    expenses: v.expenses.map((e) => ({
      date: e.date.toISOString(),
      category: e.category,
      title: e.title,
      amount: e.amount,
      notes: e.notes,
    })),
    leasing: v.leasing
      ? {
          provider: v.leasing.provider,
          monthlyRate: v.leasing.monthlyRate,
          downPayment: v.leasing.downPayment,
          startDate: v.leasing.startDate.toISOString(),
          endDate: v.leasing.endDate.toISOString(),
          startOdometer: v.leasing.startOdometer,
          annualKmLimit: v.leasing.annualKmLimit,
          excessKmCost: v.leasing.excessKmCost,
          notes: v.leasing.notes,
        }
      : null,
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
  return { filename: `kilomondo-${slugify(v.name)}.zip`, buffer };
}

// ---------------- import ----------------

const imageRef = z.object({ file: z.string(), mimeType: z.string() });
const attachmentRef = z.object({
  file: z.string(),
  fileName: z.string().max(255).default("anhang"),
  mimeType: z.string(),
});
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
    adblueTracking: z.boolean().default(false),
    tireTracking: z.boolean().default(false),
    tripLogging: z.boolean().default(false),
    leasingTracking: z.boolean().default(false),
    evTracking: z.boolean().default(false),
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
  tireSets: z
    .array(
      z.object({
        key: z.string(),
        name: z.string().min(1).max(120),
        season: z.enum(["SUMMER", "WINTER", "ALLSEASON"]).default("SUMMER"),
        dimension: z.string().nullish(),
        brand: z.string().nullish(),
        purchaseDate: z.string().nullish(),
        treadDepthMm: num.nullish(),
        storageLocation: z.string().nullish(),
        retired: z.boolean().default(false),
        notes: z.string().nullish(),
      })
    )
    .default([]),
  tireChanges: z
    .array(
      z.object({
        tireSet: z.string(),
        date: z.string(),
        odometer: num.int(),
        notes: z.string().nullish(),
      })
    )
    .default([]),
  documents: z
    .array(
      z.object({
        title: z.string().min(1).max(160),
        category: z
          .enum(["REGISTRATION", "INSURANCE", "LICENSE", "WARRANTY", "INVOICE", "OTHER"])
          .default("OTHER"),
        issueDate: z.string().nullish(),
        expiresAt: z.string().nullish(),
        notes: z.string().nullish(),
        attachments: z.array(attachmentRef).default([]),
      })
    )
    .default([]),
  expenses: z
    .array(
      z.object({
        date: z.string(),
        category: z.enum(["TAX", "INSURANCE", "FEE", "OTHER"]).default("OTHER"),
        title: z.string().nullish(),
        amount: num,
        notes: z.string().nullish(),
      })
    )
    .default([]),
  leasing: z
    .object({
      provider: z.string().nullish(),
      monthlyRate: num.nullish(),
      downPayment: num.nullish(),
      startDate: z.string(),
      endDate: z.string(),
      startOdometer: num.int().default(0),
      annualKmLimit: num.int().nullish(),
      excessKmCost: num.nullish(),
      notes: z.string().nullish(),
    })
    .nullish(),
  trips: z
    .array(
      z.object({
        date: z.string(),
        startOdometer: num.int(),
        endOdometer: num.int(),
        purpose: z.enum(["BUSINESS", "PRIVATE", "COMMUTE"]).default("BUSINESS"),
        startLocation: z.string().nullish(),
        endLocation: z.string().nullish(),
        description: z.string().nullish(),
      })
    )
    .default([]),
  chargingSessions: z
    .array(
      z.object({
        date: z.string(),
        odometer: num.int().nullish(),
        energyKwh: num,
        pricePerKwh: num.nullish(),
        totalCost: num.nullish(),
        location: z.enum(["HOME", "PUBLIC", "WORK", "OTHER"]).default("HOME"),
        provider: z.string().nullish(),
        notes: z.string().nullish(),
      })
    )
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
        attachments: z.array(attachmentRef).default([]),
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
  if (!manifestEntry) throw new Error("Kein Kilomondo-Export (manifest.json fehlt).");

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

  const createAttachment = async (
    ref: { file: string; fileName: string; mimeType: string },
    link: { repairId?: string; documentId?: string }
  ) => {
    if (!ATT_ALLOWED.has(ref.mimeType)) return;
    const f = zip.file(ref.file);
    if (!f) return;
    const data = await f.async("nodebuffer");
    if (data.length === 0 || data.length > ATT_MAX_BYTES) return;
    await db.attachment.create({
      data: {
        mimeType: ref.mimeType,
        fileName: ref.fileName,
        size: data.length,
        data: toBytes(data),
        ...link,
      },
    });
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
      adblueTracking: manifest.vehicle.adblueTracking,
      tireTracking: manifest.vehicle.tireTracking,
      tripLogging: manifest.vehicle.tripLogging,
      leasingTracking: manifest.vehicle.leasingTracking,
      evTracking: manifest.vehicle.evTracking,
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

  // Recreate tire sets (mapping export keys to fresh ids), then their changes.
  const tireSetIdByKey = new Map<string, string>();
  for (const t of manifest.tireSets) {
    const created = await db.tireSet.create({
      data: {
        vehicleId: vehicle.id,
        name: t.name,
        season: t.season,
        dimension: t.dimension ?? null,
        brand: t.brand ?? null,
        purchaseDate: t.purchaseDate ? new Date(t.purchaseDate) : null,
        treadDepthMm: t.treadDepthMm ?? null,
        storageLocation: t.storageLocation ?? null,
        retired: t.retired,
        notes: t.notes ?? null,
      },
    });
    tireSetIdByKey.set(t.key, created.id);
  }
  const tireChanges = manifest.tireChanges
    .map((c) => ({ ...c, setId: tireSetIdByKey.get(c.tireSet) }))
    .filter((c): c is typeof c & { setId: string } => !!c.setId);
  if (tireChanges.length) {
    await db.tireChange.createMany({
      data: tireChanges.map((c) => ({
        vehicleId: vehicle.id,
        tireSetId: c.setId,
        date: new Date(c.date),
        odometer: c.odometer,
        notes: c.notes ?? null,
      })),
    });
  }

  if (manifest.trips.length) {
    await db.trip.createMany({
      data: manifest.trips.map((t) => ({
        vehicleId: vehicle.id,
        date: new Date(t.date),
        startOdometer: t.startOdometer,
        endOdometer: t.endOdometer,
        purpose: t.purpose,
        startLocation: t.startLocation ?? null,
        endLocation: t.endLocation ?? null,
        description: t.description ?? null,
      })),
    });
  }

  if (manifest.expenses.length) {
    await db.expense.createMany({
      data: manifest.expenses.map((e) => ({
        vehicleId: vehicle.id,
        date: new Date(e.date),
        category: e.category,
        title: e.title ?? null,
        amount: e.amount,
        notes: e.notes ?? null,
      })),
    });
  }

  if (manifest.leasing) {
    const l = manifest.leasing;
    await db.leasingContract.create({
      data: {
        vehicleId: vehicle.id,
        provider: l.provider ?? null,
        monthlyRate: l.monthlyRate ?? null,
        downPayment: l.downPayment ?? null,
        startDate: new Date(l.startDate),
        endDate: new Date(l.endDate),
        startOdometer: l.startOdometer,
        annualKmLimit: l.annualKmLimit ?? null,
        excessKmCost: l.excessKmCost ?? null,
        notes: l.notes ?? null,
      },
    });
  }

  if (manifest.chargingSessions.length) {
    await db.chargingSession.createMany({
      data: manifest.chargingSessions.map((c) => ({
        vehicleId: vehicle.id,
        date: new Date(c.date),
        odometer: c.odometer ?? null,
        energyKwh: c.energyKwh,
        pricePerKwh: c.pricePerKwh ?? null,
        totalCost: c.totalCost ?? null,
        location: c.location,
        provider: c.provider ?? null,
        notes: c.notes ?? null,
      })),
    });
  }

  for (const d of manifest.documents) {
    const rec = await db.document.create({
      data: {
        vehicleId: vehicle.id,
        title: d.title,
        category: d.category,
        issueDate: d.issueDate ? new Date(d.issueDate) : null,
        expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
        notes: d.notes ?? null,
      },
    });
    for (const at of d.attachments) {
      await createAttachment(at, { documentId: rec.id });
    }
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
    for (const at of r.attachments) {
      await createAttachment(at, { repairId: rec.id });
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

  await ensureLogReminder(vehicle.id);
  return { vehicleId: vehicle.id };
}
