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

// Distinct colours for the wear chart's per-tire lines (theme-friendly HSL).
const WEAR_COLORS = [
  "hsl(160 84% 39%)",
  "hsl(217 91% 60%)",
  "hsl(38 92% 55%)",
  "hsl(280 65% 65%)",
  "hsl(0 72% 60%)",
  "hsl(190 80% 50%)",
  "hsl(330 70% 60%)",
  "hsl(95 60% 50%)",
];

// The four tire positions, mapped to their TireMeasurement columns.
export const TIRE_POSITIONS = [
  { field: "treadFrontLeftMm", code: "VL", label: "Vorne links" },
  { field: "treadFrontRightMm", code: "VR", label: "Vorne rechts" },
  { field: "treadRearLeftMm", code: "HL", label: "Hinten links" },
  { field: "treadRearRightMm", code: "HR", label: "Hinten rechts" },
] as const;

export type TireWearRow = { t: number; label: string; [lineKey: string]: number | string | null };
export type TireWearLine = { key: string; name: string; color: string; setId: string };
export type TireWearSeries = {
  lines: TireWearLine[];
  sets: { id: string; name: string }[];
  data: TireWearRow[];
};

/**
 * Turn per-tire tread-depth measurements into chart data: one line per tire
 * position that has readings (e.g. "Sommer VL"), points merged onto a shared
 * time axis. Sets with only an overall value (legacy rows) get a single
 * line under the set name. Returns the set list too, so a picker can filter.
 */
export function tireWearSeries(sets: TireSet[], measurements: TireMeasurement[]): TireWearSeries {
  const setsWithData = sets.filter((s) => measurements.some((m) => m.tireSetId === s.id));

  const lines: TireWearLine[] = [];
  const valueAt = new Map<string, Map<number, number>>(); // lineKey -> (time -> depth)

  for (const s of setsWithData) {
    const ms = measurements.filter((m) => m.tireSetId === s.id);
    const usedPositions = TIRE_POSITIONS.filter((p) =>
      ms.some((m) => (m[p.field] as number | null) != null)
    );
    if (usedPositions.length > 0) {
      for (const p of usedPositions) {
        const key = `${s.id}__${p.code}`;
        const byT = new Map<number, number>();
        for (const m of ms) {
          const v = m[p.field] as number | null;
          if (v != null) byT.set(m.date.getTime(), v);
        }
        lines.push({ key, name: `${s.name} ${p.code}`, setId: s.id, color: "" });
        valueAt.set(key, byT);
      }
    } else {
      const key = `${s.id}__avg`;
      const byT = new Map<number, number>();
      for (const m of ms) byT.set(m.date.getTime(), m.treadDepthMm);
      lines.push({ key, name: s.name, setId: s.id, color: "" });
      valueAt.set(key, byT);
    }
  }

  lines.forEach((l, i) => (l.color = WEAR_COLORS[i % WEAR_COLORS.length]));

  const times = new Set<number>();
  for (const m of measurements) {
    if (setsWithData.some((s) => s.id === m.tireSetId)) times.add(m.date.getTime());
  }
  const data: TireWearRow[] = [...times]
    .sort((a, b) => a - b)
    .map((t) => {
      const row: TireWearRow = { t, label: formatDate(new Date(t)) };
      for (const l of lines) row[l.key] = valueAt.get(l.key)?.get(t) ?? null;
      return row;
    });

  return { lines, sets: setsWithData.map((s) => ({ id: s.id, name: s.name })), data };
}

/**
 * The lowest tread depth from a set's most recent measurement — the value a
 * wear alert should compare against (a single worn tire matters most). Falls
 * back to the row's average when no per-tire values were entered.
 */
export function latestMinTread(measurements: TireMeasurement[]): number | null {
  if (measurements.length === 0) return null;
  const latest = measurements.reduce((a, b) => (b.date >= a.date ? b : a));
  const perTire = TIRE_POSITIONS.map((p) => latest[p.field] as number | null).filter(
    (v): v is number => v != null
  );
  if (perTire.length > 0) return Math.min(...perTire);
  return latest.treadDepthMm ?? null;
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
