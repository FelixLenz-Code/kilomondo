import "server-only";
import JSZip from "jszip";
import { db } from "@/lib/db";
import { vehicleAccessWhere } from "@/lib/auth/guards";
import { fuelUnit } from "@/lib/stats";
import { summariseTireSets, tireSeasonLabel } from "@/lib/tires";
import { documentCategoryLabel } from "@/lib/documents";
import { tripPurposeLabel } from "@/lib/trips";
import { chargingLocationLabel } from "@/lib/charging";
import { expenseCategoryLabel } from "@/lib/expenses";

/**
 * Spreadsheet-friendly CSV export: a ZIP with one CSV per data type.
 * German Excel conventions — semicolon separator, comma decimals, UTF-8 BOM.
 */

const BOM = "﻿";
const SEP = ";";

function cell(value: unknown): string {
  if (value == null) return "";
  let s: string;
  if (typeof value === "number") {
    s = Number.isInteger(value) ? String(value) : value.toFixed(3);
    s = s.replace(".", ","); // German decimal comma
  } else {
    s = String(value);
  }
  // Quote when the value contains the separator, quotes or a newline.
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(SEP), ...rows.map((r) => r.map(cell).join(SEP))];
  return BOM + lines.join("\r\n") + "\r\n";
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

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

export async function exportVehicleCsv(
  vehicleId: string,
  userId: string
): Promise<{ filename: string; buffer: Buffer } | null> {
  const v = await db.vehicle.findFirst({
    where: { id: vehicleId, ...vehicleAccessWhere(userId) },
    include: {
      fuelEntries: { orderBy: { date: "asc" } },
      odometerEntries: { orderBy: { date: "asc" } },
      repairEntries: { orderBy: { date: "asc" } },
      cleaningEntries: { orderBy: { date: "asc" } },
      tireSets: { orderBy: { createdAt: "asc" } },
      tireChanges: { orderBy: { date: "asc" } },
      documents: { orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }] },
      trips: { orderBy: [{ date: "asc" }, { startOdometer: "asc" }] },
      chargingSessions: { orderBy: { date: "asc" } },
      expenses: { orderBy: { date: "asc" } },
    },
  });
  if (!v) return null;

  const unit = fuelUnit(v);
  const zip = new JSZip();

  zip.file(
    "tankungen.csv",
    csv(
      ["Datum", "Kilometerstand", `Menge (${unit})`, `Preis (€/${unit})`, "Gesamt (€)", "Vollbetankung", "AdBlue (€)", "Art", "Tankstelle", "Notiz"],
      v.fuelEntries.map((f) => [
        isoDate(f.date),
        f.odometer,
        f.amount,
        f.pricePerUnit,
        f.totalCost,
        f.isFullTank ? "ja" : "nein",
        f.adbluePrice ?? "",
        f.kind === "CANISTER" ? "Kanister" : "Direkt",
        f.station ?? "",
        f.notes ?? "",
      ])
    )
  );

  zip.file(
    "kilometerstaende.csv",
    csv(
      ["Datum", "Kilometerstand", "Notiz"],
      v.odometerEntries.map((o) => [isoDate(o.date), o.odometer, o.note ?? ""])
    )
  );

  const repairCategory: Record<string, string> = {
    REPAIR: "Reparatur",
    SERVICE: "Service",
    INSPECTION: "HU/AU",
    TIRES: "Reifen",
    OTHER: "Sonstiges",
  };
  zip.file(
    "reparaturen.csv",
    csv(
      ["Datum", "Kilometerstand", "Kategorie", "Titel", "Kosten (€)", "Werkstatt", "Beschreibung", "Notiz"],
      v.repairEntries.map((r) => [
        isoDate(r.date),
        r.odometer ?? "",
        repairCategory[r.category] ?? r.category,
        r.title,
        r.cost,
        r.workshop ?? "",
        r.description ?? "",
        r.notes ?? "",
      ])
    )
  );

  const cleaningType: Record<string, string> = {
    INTERIOR: "Innen",
    EXTERIOR: "Außen",
    FULL: "Komplett",
  };
  zip.file(
    "pflege.csv",
    csv(
      ["Datum", "Kilometerstand", "Art", "Kosten (€)", "Produkte", "Notiz"],
      v.cleaningEntries.map((c) => [
        isoDate(c.date),
        c.odometer ?? "",
        cleaningType[c.type] ?? c.type,
        c.cost,
        c.products ?? "",
        c.notes ?? "",
      ])
    )
  );

  if (v.tireTracking && (v.tireSets.length || v.tireChanges.length)) {
    const currentOdometer = Math.max(
      v.initialOdometer,
      ...v.fuelEntries.map((f) => f.odometer),
      ...v.odometerEntries.map((o) => o.odometer),
      ...v.repairEntries.map((r) => r.odometer ?? 0),
      ...v.cleaningEntries.map((c) => c.odometer ?? 0),
      ...v.tireChanges.map((c) => c.odometer)
    );
    const summaries = summariseTireSets(v.tireSets, v.tireChanges, currentOdometer);
    zip.file(
      "radsaetze.csv",
      csv(
        ["Bezeichnung", "Saison", "Größe", "Marke", "Kaufdatum", "Profil (mm)", "Einlagerung", "Ausgemustert", "Gefahrene km", "Notiz"],
        summaries.map((t) => [
          t.name,
          tireSeasonLabel(t.season),
          t.dimension ?? "",
          t.brand ?? "",
          t.purchaseDate ? isoDate(t.purchaseDate) : "",
          t.treadDepthMm ?? "",
          t.storageLocation ?? "",
          t.retired ? "ja" : "nein",
          t.mountedKm,
          t.notes ?? "",
        ])
      )
    );
    const setName = new Map(v.tireSets.map((s) => [s.id, s.name]));
    zip.file(
      "radwechsel.csv",
      csv(
        ["Datum", "Kilometerstand", "Radsatz", "Notiz"],
        v.tireChanges.map((c) => [
          isoDate(c.date),
          c.odometer,
          setName.get(c.tireSetId) ?? "",
          c.notes ?? "",
        ])
      )
    );
  }

  if (v.documents.length) {
    zip.file(
      "dokumente.csv",
      csv(
        ["Titel", "Kategorie", "Ausgestellt", "Gültig bis", "Notiz"],
        v.documents.map((d) => [
          d.title,
          documentCategoryLabel(d.category),
          d.issueDate ? isoDate(d.issueDate) : "",
          d.expiresAt ? isoDate(d.expiresAt) : "",
          d.notes ?? "",
        ])
      )
    );
  }

  if (v.tripLogging && v.trips.length) {
    zip.file(
      "fahrtenbuch.csv",
      csv(
        ["Datum", "Zweck", "Start-km", "End-km", "Strecke (km)", "Von", "Nach", "Notiz"],
        v.trips.map((t) => [
          isoDate(t.date),
          tripPurposeLabel(t.purpose),
          t.startOdometer,
          t.endOdometer,
          Math.max(0, t.endOdometer - t.startOdometer),
          t.startLocation ?? "",
          t.endLocation ?? "",
          t.description ?? "",
        ])
      )
    );
  }

  if (v.evTracking && v.chargingSessions.length) {
    zip.file(
      "ladevorgaenge.csv",
      csv(
        ["Datum", "Ladeort", "Energie (kWh)", "Preis (€/kWh)", "Gesamt (€)", "Kilometerstand", "Anbieter", "Notiz"],
        v.chargingSessions.map((c) => [
          isoDate(c.date),
          chargingLocationLabel(c.location),
          c.energyKwh,
          c.pricePerKwh ?? "",
          c.totalCost ?? "",
          c.odometer ?? "",
          c.provider ?? "",
          c.notes ?? "",
        ])
      )
    );
  }

  if (v.expenses.length) {
    zip.file(
      "kosten.csv",
      csv(
        ["Datum", "Kategorie", "Bezeichnung", "Betrag (€)", "Notiz"],
        v.expenses.map((e) => [
          isoDate(e.date),
          expenseCategoryLabel(e.category),
          e.title ?? "",
          e.amount,
          e.notes ?? "",
        ])
      )
    );
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return { filename: `kilomondo-${slugify(v.name)}-csv.zip`, buffer };
}
