import "server-only";
import { db } from "@/lib/db";
import { computeStats, fuelUnit, consumptionUnit, type VehicleData } from "@/lib/stats";
import { formatCurrency, formatDate, formatKm, formatNumber } from "@/lib/utils";

/**
 * Build a clean, print-friendly A4 overview of a vehicle (details, key figures
 * and the full fuel / repair / cleaning logs) and render it to PDF with the
 * headless Chromium that's already bundled for the 3D animation.
 */

const FUEL_TYPE: Record<string, string> = {
  PETROL: "Benzin",
  DIESEL: "Diesel",
  ELECTRIC: "Elektro",
  HYBRID: "Hybrid",
  LPG: "LPG",
};
const REPAIR_CAT: Record<string, string> = {
  REPAIR: "Reparatur",
  SERVICE: "Service",
  INSPECTION: "HU/AU",
  TIRES: "Reifen",
  OTHER: "Sonstiges",
};
const CLEAN_TYPE: Record<string, string> = {
  FULL: "Komplett",
  EXTERIOR: "Außen",
  INTERIOR: "Innen",
};

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(name: string): string {
  return (
    name.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase() ||
    "fahrzeug"
  );
}

function buildHtml(data: VehicleData): string {
  const v = data.vehicle;
  const stats = computeStats(data);
  const unit = fuelUnit(v);

  const detail = (label: string, value: string) =>
    `<div class="d"><span class="dl">${label}</span><span class="dv">${value}</span></div>`;
  const details = [
    v.make || v.model || v.year ? detail("Modell", esc([v.make, v.model, v.year].filter(Boolean).join(" "))) : "",
    v.licensePlate ? detail("Kennzeichen", esc(v.licensePlate)) : "",
    v.vin ? detail("FIN", esc(v.vin)) : "",
    detail("Kraftstoff", FUEL_TYPE[v.fuelType] ?? esc(v.fuelType)),
    v.color ? detail("Farbe", esc(v.color)) : "",
  ].join("");

  const stat = (label: string, value: string) =>
    `<div class="stat"><div class="sv">${value}</div><div class="sl">${label}</div></div>`;
  const cards = [
    stat("Aktueller km-Stand", formatKm(stats.currentOdometer)),
    stat("Gefahrene Strecke", formatKm(stats.totalDistance)),
    stat(`Ø Verbrauch`, stats.avgConsumption != null ? `${formatNumber(stats.avgConsumption, 1)} ${consumptionUnit(v)}` : "–"),
    stat("Tankkosten", formatCurrency(stats.totalFuelCost)),
    stat("Reparaturkosten", formatCurrency(stats.totalRepairCost)),
    stat("Pflegekosten", formatCurrency(stats.totalCleaningCost)),
    stat("Gesamtkosten", formatCurrency(stats.totalCost)),
    stat("Kosten / km", stats.costPerKm != null ? formatCurrency(stats.costPerKm) : "–"),
    stat(`Ø Preis / ${unit}`, stats.avgPricePerUnit != null ? `${formatNumber(stats.avgPricePerUnit, 3)} €` : "–"),
  ].join("");

  const fuelRows = data.fuelEntries
    .map(
      (f) => `<tr>
        <td>${formatDate(f.date)}</td>
        <td class="r">${formatKm(f.odometer)}</td>
        <td>${f.kind === "CANISTER" ? "Kanister" : "Auto"}</td>
        <td class="r">${formatNumber(f.amount, 2)} ${unit}</td>
        <td class="r">${f.pricePerUnit ? `${formatNumber(f.pricePerUnit, 3)} €` : "–"}</td>
        <td class="r">${formatCurrency(f.totalCost)}</td>
        <td>${f.isFullTank ? "Voll" : ""}</td>
        <td>${esc(f.station ?? "")}</td>
      </tr>`
    )
    .join("");
  const fuelTable = data.fuelEntries.length
    ? `<table>
        <thead><tr><th>Datum</th><th class="r">km</th><th>Typ</th><th class="r">Menge</th><th class="r">Preis/${unit}</th><th class="r">Gesamt</th><th>Tank</th><th>Tankstelle</th></tr></thead>
        <tbody>${fuelRows}</tbody>
        <tfoot><tr><td colspan="3">Summe</td><td class="r">${formatNumber(stats.totalFuelAmount, 2)} ${unit}</td><td></td><td class="r">${formatCurrency(stats.totalFuelCost)}</td><td colspan="2"></td></tr></tfoot>
      </table>`
    : `<p class="empty">Keine Tankungen erfasst.</p>`;

  const repairRows = data.repairEntries
    .map(
      (r) => `<tr>
        <td>${formatDate(r.date)}</td>
        <td class="r">${r.odometer != null ? formatKm(r.odometer) : "–"}</td>
        <td>${esc(r.title)}</td>
        <td>${REPAIR_CAT[r.category] ?? esc(r.category)}</td>
        <td>${esc(r.workshop ?? "")}</td>
        <td class="r">${formatCurrency(r.cost)}</td>
      </tr>`
    )
    .join("");
  const repairTable = data.repairEntries.length
    ? `<table>
        <thead><tr><th>Datum</th><th class="r">km</th><th>Titel</th><th>Kategorie</th><th>Werkstatt</th><th class="r">Kosten</th></tr></thead>
        <tbody>${repairRows}</tbody>
        <tfoot><tr><td colspan="5">Summe</td><td class="r">${formatCurrency(stats.totalRepairCost)}</td></tr></tfoot>
      </table>`
    : `<p class="empty">Keine Reparaturen erfasst.</p>`;

  const cleanRows = data.cleaningEntries
    .map(
      (c) => `<tr>
        <td>${formatDate(c.date)}</td>
        <td class="r">${c.odometer != null ? formatKm(c.odometer) : "–"}</td>
        <td>${CLEAN_TYPE[c.type] ?? esc(c.type)}</td>
        <td>${esc(c.products ?? "")}</td>
        <td class="r">${formatCurrency(c.cost)}</td>
      </tr>`
    )
    .join("");
  const cleanTable = data.cleaningEntries.length
    ? `<table>
        <thead><tr><th>Datum</th><th class="r">km</th><th>Art</th><th>Produkte</th><th class="r">Kosten</th></tr></thead>
        <tbody>${cleanRows}</tbody>
        <tfoot><tr><td colspan="4">Summe</td><td class="r">${formatCurrency(stats.totalCleaningCost)}</td></tr></tfoot>
      </table>`
    : `<p class="empty">Keine Pflege-Einträge erfasst.</p>`;

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>
  @page { size: A4; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a; font-size: 11px; line-height: 1.45; }
  h1 { font-size: 22px; margin: 0; }
  .sub { color: #555; margin: 2px 0 0; font-size: 12px; }
  .meta { color: #777; font-size: 10px; margin-top: 2px; }
  h2 { font-size: 13px; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #222;
    page-break-after: avoid; }
  .details { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 18px; margin-top: 12px; }
  .d { display: flex; justify-content: space-between; gap: 8px; border-bottom: 1px solid #eee; padding: 2px 0; }
  .dl { color: #666; } .dv { font-weight: 600; text-align: right; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .stat { border: 1px solid #e2e2e2; border-radius: 6px; padding: 8px 10px; }
  .sv { font-size: 15px; font-weight: 700; } .sl { color: #666; font-size: 10px; margin-top: 1px; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th, td { padding: 4px 6px; text-align: left; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
  th { background: #f1f2f4; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; color: #444; }
  td.r, th.r { text-align: right; white-space: nowrap; }
  tbody tr { page-break-inside: avoid; }
  tfoot td { font-weight: 700; border-top: 2px solid #222; border-bottom: none; }
  .empty { color: #888; font-style: italic; }
  section { page-break-inside: auto; }
  </style></head><body>
    <header>
      <h1>${esc(v.name)}</h1>
      ${[v.make, v.model, v.year].filter(Boolean).length ? `<p class="sub">${esc([v.make, v.model, v.year].filter(Boolean).join(" "))}</p>` : ""}
      <p class="meta">Fahrzeugübersicht · erstellt am ${formatDate(new Date())}</p>
      <div class="details">${details}</div>
    </header>

    <section><h2>Kennzahlen</h2><div class="stats">${cards}</div></section>
    <section><h2>Tankbuch (${data.fuelEntries.length})</h2>${fuelTable}</section>
    <section><h2>Reparaturen (${data.repairEntries.length})</h2>${repairTable}</section>
    <section><h2>Pflege (${data.cleaningEntries.length})</h2>${cleanTable}</section>
  </body></html>`;
}

export async function generateVehiclePdf(
  vehicleId: string,
  userId: string
): Promise<{ filename: string; buffer: Buffer } | null> {
  const vehicle = await db.vehicle.findFirst({
    where: { id: vehicleId, userId },
    include: {
      fuelEntries: { orderBy: [{ date: "desc" }, { odometer: "desc" }] },
      odometerEntries: { orderBy: [{ date: "desc" }] },
      repairEntries: { orderBy: [{ date: "desc" }] },
      cleaningEntries: { orderBy: [{ date: "desc" }] },
    },
  });
  if (!vehicle) return null;

  const html = buildHtml({
    vehicle,
    fuelEntries: vehicle.fuelEntries,
    odometerEntries: vehicle.odometerEntries,
    repairEntries: vehicle.repairEntries,
    cleaningEntries: vehicle.cleaningEntries,
  });

  const puppeteer = (await import("puppeteer")).default;
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", bottom: "16mm", left: "13mm", right: "13mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="width:100%;font-size:8px;color:#888;padding:0 13mm;display:flex;justify-content:space-between;">' +
        `<span>${esc(vehicle.name)}</span>` +
        '<span>Seite <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    });
    return { filename: `carlog-${slugify(vehicle.name)}.pdf`, buffer: Buffer.from(pdf) };
  } finally {
    await browser.close().catch(() => {});
  }
}
