import type { ChargingSession, ChargingLocation } from "@prisma/client";

export function chargingLocationLabel(location: ChargingLocation): string {
  switch (location) {
    case "HOME":
      return "Zu Hause";
    case "PUBLIC":
      return "Öffentlich";
    case "WORK":
      return "Arbeit";
    case "OTHER":
      return "Sonstige";
  }
}

export type ChargingSummary = {
  count: number;
  totalKwh: number;
  totalCost: number;
  avgPricePerKwh: number | null;
  homeKwh: number;
  publicKwh: number;
};

export function summariseCharging(sessions: ChargingSession[]): ChargingSummary {
  let totalKwh = 0;
  let totalCost = 0;
  let homeKwh = 0;
  let publicKwh = 0;
  for (const s of sessions) {
    totalKwh += s.energyKwh;
    totalCost += s.totalCost ?? 0;
    if (s.location === "HOME") homeKwh += s.energyKwh;
    else if (s.location === "PUBLIC") publicKwh += s.energyKwh;
  }
  return {
    count: sessions.length,
    totalKwh,
    totalCost,
    avgPricePerKwh: totalKwh > 0 && totalCost > 0 ? totalCost / totalKwh : null,
    homeKwh,
    publicKwh,
  };
}

/** Fill in price/total from whichever the user provided. */
export function resolveChargingCost(
  energyKwh: number,
  pricePerKwh?: number,
  totalCost?: number
): { pricePerKwh: number | null; totalCost: number | null } {
  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
  if (totalCost == null && pricePerKwh != null) {
    return { pricePerKwh, totalCost: r2(energyKwh * pricePerKwh) };
  }
  if (pricePerKwh == null && totalCost != null && energyKwh > 0) {
    return { pricePerKwh: r3(totalCost / energyKwh), totalCost };
  }
  return { pricePerKwh: pricePerKwh ?? null, totalCost: totalCost ?? null };
}
