import type { LeasingContract } from "@prisma/client";

const DAY = 24 * 60 * 60 * 1000;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export type LeasingStatus = {
  totalDays: number;
  elapsedDays: number;
  elapsedFraction: number; // 0..1
  remainingDays: number;
  monthsTotal: number;
  // km
  totalKmAllowed: number | null;
  drivenSinceStart: number;
  allowedSoFar: number | null;
  projectedTotal: number; // linear extrapolation to contract end
  projectedExcess: number | null; // km expected over the limit
  projectedExcessCost: number | null; // € expected for the excess
  overBudgetNow: boolean; // already driving faster than allowed pace
};

export function leasingStatus(
  c: LeasingContract,
  currentOdometer: number,
  now = new Date()
): LeasingStatus {
  const start = c.startDate.getTime();
  const end = c.endDate.getTime();
  const totalDays = Math.max(0, (end - start) / DAY);
  const elapsedDays = clamp((now.getTime() - start) / DAY, 0, totalDays);
  const elapsedFraction = totalDays > 0 ? elapsedDays / totalDays : 0;
  const years = totalDays / 365.25;

  const totalKmAllowed = c.annualKmLimit != null ? Math.round(c.annualKmLimit * years) : null;
  const drivenSinceStart = Math.max(0, currentOdometer - c.startOdometer);
  const allowedSoFar = totalKmAllowed != null ? totalKmAllowed * elapsedFraction : null;
  const projectedTotal =
    elapsedFraction > 0 ? Math.round(drivenSinceStart / elapsedFraction) : drivenSinceStart;
  const projectedExcess =
    totalKmAllowed != null ? Math.max(0, projectedTotal - totalKmAllowed) : null;
  const projectedExcessCost =
    projectedExcess != null && c.excessKmCost != null
      ? Math.round(projectedExcess * c.excessKmCost * 100) / 100
      : null;
  const overBudgetNow = allowedSoFar != null && drivenSinceStart > allowedSoFar;

  return {
    totalDays,
    elapsedDays,
    elapsedFraction,
    remainingDays: Math.max(0, totalDays - elapsedDays),
    monthsTotal: Math.round(totalDays / 30.44),
    totalKmAllowed,
    drivenSinceStart,
    allowedSoFar: allowedSoFar != null ? Math.round(allowedSoFar) : null,
    projectedTotal,
    projectedExcess,
    projectedExcessCost,
    overBudgetNow,
  };
}
