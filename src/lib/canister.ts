import "server-only";
import { db } from "@/lib/db";

export type CanisterState = {
  liters: number; // current contents
  value: number; // current monetary value (€) of the contents
  avgPrice: number; // value / liters, 0 when empty
  capacity: number;
};

const EPS = 1e-6;

/**
 * Current contents & value of a canister, using weighted-average inventory:
 * fills add liters + their cost, pours (FuelEntry kind=CANISTER) subtract liters
 * and their stored cost. Replayed in chronological order so the average is
 * consistent with the cost already recorded on each pour.
 */
export async function canisterState(canisterId: string): Promise<CanisterState | null> {
  const canister = await db.canister.findUnique({ where: { id: canisterId } });
  if (!canister) return null;

  const [fills, pours] = await Promise.all([
    db.canisterFill.findMany({
      where: { canisterId },
      select: { date: true, liters: true, totalCost: true, createdAt: true },
    }),
    db.fuelEntry.findMany({
      where: { canisterId, kind: "CANISTER" },
      select: { date: true, amount: true, totalCost: true, createdAt: true },
    }),
  ]);

  const events = [
    ...fills.map((f) => ({ t: f.date.getTime(), c: f.createdAt.getTime(), liters: f.liters, cost: f.totalCost })),
    ...pours.map((p) => ({ t: p.date.getTime(), c: p.createdAt.getTime(), liters: -p.amount, cost: -p.totalCost })),
  ].sort((a, b) => a.t - b.t || a.c - b.c);

  let liters = 0;
  let value = 0;
  for (const e of events) {
    liters += e.liters;
    value += e.cost;
  }
  if (liters < EPS) {
    liters = 0;
    value = 0;
  }
  const avgPrice = liters > EPS ? value / liters : 0;
  return { liters, value, avgPrice, capacity: canister.capacity };
}

/** Round to 2 decimals (currency). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
