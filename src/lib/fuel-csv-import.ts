/**
 * Best-effort importer for fuel logs exported from other apps (Spritmonitor,
 * Fuelio, …). Column names, delimiters, decimal separators and date formats
 * vary, so everything is detected heuristically and unparseable rows are
 * skipped rather than failing the whole import.
 */

export type ParsedFuelEntry = {
  date: Date;
  odometer: number;
  amount: number;
  pricePerUnit: number;
  totalCost: number;
  isFullTank: boolean;
  station?: string;
  notes?: string;
};

export type ParseResult = {
  entries: ParsedFuelEntry[];
  skipped: number;
  error?: string;
};

function detectDelimiter(headerLine: string): string {
  const counts = [";", ",", "\t"].map((d) => ({ d, n: headerLine.split(d).length }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 1 ? counts[0].d : ",";
}

/** Split a single CSV line honouring double-quoted fields. */
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöü]/g, "");

function findCol(headers: string[], keywords: string[]): number {
  const normed = headers.map(norm);
  for (let i = 0; i < normed.length; i++) {
    if (keywords.some((k) => normed[i].includes(k))) return i;
  }
  return -1;
}

export function parseNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  let s = raw.replace(/[^\d.,-]/g, "").trim();
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Both present: the rightmost separator is the decimal point.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    // Comma only → treat as decimal comma.
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) {
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  // DD.MM.YYYY (Spritmonitor) or D/M/Y. Disambiguate by which part exceeds 12.
  if ((m = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/.exec(s))) {
    let [, a, b, y] = m;
    let year = +y;
    if (year < 100) year += 2000;
    let day = +a;
    let month = +b;
    if (month > 12 && day <= 12) {
      // Looks like M/D/Y.
      [day, month] = [month, day];
    }
    return new Date(year, month - 1, day);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const truthy = (s: string | undefined) =>
  s != null && /^(1|x|ja|yes|true|voll|full|y)$/i.test(s.trim());

export function parseFuelCsv(text: string): ParseResult {
  // Strip a UTF-8 BOM and split into non-empty lines.
  const clean = text.replace(/^﻿/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { entries: [], skipped: 0, error: "Datei enthält keine Datenzeilen." };
  }

  const delim = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delim);

  const idx = {
    date: findCol(headers, ["datum", "date", "tag"]),
    odometer: findCol(headers, ["kilometerstand", "zähler", "zaehler", "odometer", "tacho", "mileage", "km"]),
    amount: findCol(headers, ["menge", "liter", "litre", "volume", "getankt", "kwh", "fuel"]),
    price: findCol(headers, ["preisproeinheit", "preisjeeinheit", "preisproliter", "preisliter", "pricepunit", "priceperunit", "preis", "price", "ppl"]),
    total: findCol(headers, ["gesamtpreis", "gesamt", "totalprice", "total", "summe", "kosten", "cost", "betrag"]),
    full: findCol(headers, ["vollgetankt", "voll", "full", "komplett", "fulltank"]),
    station: findCol(headers, ["tankstelle", "station", "ort", "location"]),
    notes: findCol(headers, ["notiz", "note", "bemerkung", "comment", "kommentar"]),
  };

  if (idx.date < 0 || idx.odometer < 0 || idx.amount < 0) {
    return {
      entries: [],
      skipped: 0,
      error:
        "Spalten für Datum, Kilometerstand und Menge nicht erkannt. Erwartet werden z. B. Spritmonitor- oder Fuelio-Exporte.",
    };
  }

  const get = (cols: string[], i: number) => (i >= 0 && i < cols.length ? cols[i] : undefined);
  const entries: ParsedFuelEntry[] = [];
  let skipped = 0;

  for (let r = 1; r < lines.length; r++) {
    const cols = splitLine(lines[r], delim);
    const date = parseDate(get(cols, idx.date));
    const odometer = parseNumber(get(cols, idx.odometer));
    const amount = parseNumber(get(cols, idx.amount));
    if (!date || odometer == null || amount == null || amount <= 0) {
      skipped++;
      continue;
    }
    let price = parseNumber(get(cols, idx.price));
    let total = parseNumber(get(cols, idx.total));
    if (total == null && price != null) total = price * amount;
    if (price == null && total != null && amount > 0) price = total / amount;
    price = price ?? 0;
    total = total ?? 0;

    entries.push({
      date,
      odometer: Math.round(odometer),
      amount,
      pricePerUnit: Math.round(price * 1000) / 1000,
      totalCost: Math.round(total * 100) / 100,
      isFullTank: idx.full >= 0 ? truthy(get(cols, idx.full)) : true,
      station: idx.station >= 0 ? get(cols, idx.station) || undefined : undefined,
      notes: idx.notes >= 0 ? get(cols, idx.notes) || undefined : undefined,
    });
  }

  return { entries, skipped };
}
