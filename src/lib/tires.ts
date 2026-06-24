import type { TireChange, TireSet } from "@prisma/client";

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
