import type { Trip, TripPurpose } from "@prisma/client";

export function tripPurposeLabel(purpose: TripPurpose): string {
  switch (purpose) {
    case "BUSINESS":
      return "Geschäftlich";
    case "PRIVATE":
      return "Privat";
    case "COMMUTE":
      return "Arbeitsweg";
  }
}

export type TripSummary = {
  count: number;
  total: number;
  business: number;
  private: number;
  commute: number;
};

/** Sum trip distances overall and per purpose (for the tax-relevant split). */
export function summariseTrips(trips: Trip[]): TripSummary {
  const s: TripSummary = { count: trips.length, total: 0, business: 0, private: 0, commute: 0 };
  for (const t of trips) {
    const km = Math.max(0, t.endOdometer - t.startOdometer);
    s.total += km;
    if (t.purpose === "BUSINESS") s.business += km;
    else if (t.purpose === "PRIVATE") s.private += km;
    else s.commute += km;
  }
  return s;
}
