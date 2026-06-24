import type { TireChange, TireMeasurement, TireSet } from "@prisma/client";
import { formatDate } from "@/lib/utils";

export type TireSetSummary = TireSet & {
  // Total km driven while this set was mounted (derived from the change log).
  mountedKm: number;
  isCurrent: boolean;
  lastMountedAt: Date | null;
};

/**
 * Summarise tire sets with the distance driven on each. The TireChange log is a
 * chronological list of "mounted set X at odometer Y"; a set accumulates the
 * distance between its mount and the next change (or the current odometer for
 * the set mounted last).
 */
export function summariseTireSets(
  sets: TireSet[],
  changes: TireChange[],
  currentOdometer: number
): TireSetSummary[] {
  const sorted = [...changes].sort(
    (a, b) => a.odometer - b.odometer || a.date.getTime() - b.date.getTime()
  );

  const kmBySet = new Map<string, number>();
  const lastMountById = new Map<string, Date>();
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const nextOdo = i + 1 < sorted.length ? sorted[i + 1].odometer : currentOdometer;
    const dist = Math.max(0, nextOdo - cur.odometer);
    kmBySet.set(cur.tireSetId, (kmBySet.get(cur.tireSetId) ?? 0) + dist);
    lastMountById.set(cur.tireSetId, cur.date); // sorted asc → final write = latest mount
  }

  const currentSetId = sorted.length ? sorted[sorted.length - 1].tireSetId : null;

  return sets.map((s) => ({
    ...s,
    mountedKm: kmBySet.get(s.id) ?? 0,
    isCurrent: s.id === currentSetId,
    lastMountedAt: lastMountById.get(s.id) ?? null,
  }));
}

// Distinct colours for the wear chart's per-set lines (theme-friendly HSL).
const WEAR_COLORS = [
  "hsl(160 84% 39%)",
  "hsl(217 91% 60%)",
  "hsl(38 92% 55%)",
  "hsl(280 65% 65%)",
  "hsl(0 72% 60%)",
  "hsl(190 80% 50%)",
];

// A chart row: a shared time axis (t/label) plus one depth value per set id.
// The index signature allows the fixed string label alongside numeric depths.
export type TireWearRow = { t: number; label: string; [setKey: string]: number | string | null };
export type TireWearSeries = {
  sets: { key: string; name: string; color: string }[];
  data: TireWearRow[];
};

/**
 * Turn tread-depth measurements into chart data: one line per set that has
 * readings, points merged onto a shared time axis (missing values left null so
 * recharts can bridge them). Sets are keyed by id; the legend uses their names.
 */
export function tireWearSeries(sets: TireSet[], measurements: TireMeasurement[]): TireWearSeries {
  const withData = sets.filter((s) => measurements.some((m) => m.tireSetId === s.id));
  const seriesSets = withData.map((s, i) => ({
    key: s.id,
    name: s.name,
    color: WEAR_COLORS[i % WEAR_COLORS.length],
  }));

  const byTime = new Map<number, TireWearRow>();
  for (const m of measurements) {
    if (!withData.some((s) => s.id === m.tireSetId)) continue;
    const t = m.date.getTime();
    let row = byTime.get(t);
    if (!row) {
      row = { t, label: formatDate(m.date) };
      for (const s of seriesSets) row[s.key] = null;
      byTime.set(t, row);
    }
    row[m.tireSetId] = m.treadDepthMm;
  }

  const data = [...byTime.values()].sort((a, b) => a.t - b.t);
  return { sets: seriesSets, data };
}

export function tireSeasonLabel(season: TireSet["season"]): string {
  switch (season) {
    case "SUMMER":
      return "Sommer";
    case "WINTER":
      return "Winter";
    case "ALLSEASON":
      return "Ganzjahr";
  }
}
