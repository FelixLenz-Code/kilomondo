import type {
  CleaningEntry,
  FuelEntry,
  OdometerEntry,
  RepairEntry,
  Vehicle,
} from "@prisma/client";

export type VehicleData = {
  vehicle: Vehicle;
  fuelEntries: FuelEntry[];
  odometerEntries: OdometerEntry[];
  repairEntries: RepairEntry[];
  cleaningEntries: CleaningEntry[];
};

export type VehicleStats = {
  currentOdometer: number;
  totalDistance: number;
  fuelCount: number;
  totalFuelAmount: number;
  totalFuelCost: number;
  totalRepairCost: number;
  totalCleaningCost: number;
  totalCost: number;
  avgConsumption: number | null; // L (or kWh) / 100km
  costPerKm: number | null;
  avgPricePerUnit: number | null;
};

export type ConsumptionPoint = {
  date: string; // ISO date
  odometer: number;
  consumption: number; // per 100km for this leg
  pricePerUnit: number;
};

const isElectric = (v: Vehicle) =>
  v.fuelType === "ELECTRIC" || v.fuelType === "HYBRID";

export function fuelUnit(v: Vehicle): string {
  return isElectric(v) ? "kWh" : "L";
}

export function consumptionUnit(v: Vehicle): string {
  return `${fuelUnit(v)}/100km`;
}

/**
 * Compute consumption between consecutive full-tank fill-ups.
 * Standard "full-to-full" method: the fuel added at a full tank covers the
 * distance driven since the previous full tank.
 */
export function consumptionSeries(data: VehicleData): ConsumptionPoint[] {
  const fills = [...data.fuelEntries].sort(
    (a, b) => a.odometer - b.odometer || a.date.getTime() - b.date.getTime()
  );

  const points: ConsumptionPoint[] = [];
  let lastFullOdo: number | null = null;
  let amountSinceFull = 0;

  for (const f of fills) {
    amountSinceFull += f.amount;
    if (f.isFullTank) {
      if (lastFullOdo !== null) {
        const distance = f.odometer - lastFullOdo;
        if (distance > 0) {
          points.push({
            date: f.date.toISOString(),
            odometer: f.odometer,
            consumption: (amountSinceFull / distance) * 100,
            pricePerUnit: f.pricePerUnit,
          });
        }
      }
      lastFullOdo = f.odometer;
      amountSinceFull = 0;
    }
  }
  return points;
}

export function computeStats(data: VehicleData): VehicleStats {
  const { vehicle, fuelEntries, odometerEntries, repairEntries, cleaningEntries } =
    data;

  const odoValues = [
    vehicle.initialOdometer,
    ...fuelEntries.map((f) => f.odometer),
    ...odometerEntries.map((o) => o.odometer),
    ...repairEntries.map((r) => r.odometer ?? 0),
    ...cleaningEntries.map((c) => c.odometer ?? 0),
  ];
  const currentOdometer = Math.max(...odoValues, 0);
  const totalDistance = Math.max(currentOdometer - vehicle.initialOdometer, 0);

  const totalFuelAmount = fuelEntries.reduce((s, f) => s + f.amount, 0);
  const totalFuelCost = fuelEntries.reduce((s, f) => s + f.totalCost, 0);
  // AdBlue top-ups are a separate cost (no volume) — counted in the overall total
  // but kept out of fuel amount / price-per-unit / consumption.
  const totalAdblueCost = fuelEntries.reduce((s, f) => s + (f.adbluePrice ?? 0), 0);
  const totalRepairCost = repairEntries.reduce((s, r) => s + r.cost, 0);
  const totalCleaningCost = cleaningEntries.reduce((s, c) => s + c.cost, 0);
  const totalCost = totalFuelCost + totalAdblueCost + totalRepairCost + totalCleaningCost;

  const points = consumptionSeries(data);
  const avgConsumption =
    points.length > 0
      ? points.reduce((s, p) => s + p.consumption, 0) / points.length
      : null;

  const costPerKm = totalDistance > 0 ? totalCost / totalDistance : null;
  const avgPricePerUnit =
    totalFuelAmount > 0 ? totalFuelCost / totalFuelAmount : null;

  return {
    currentOdometer,
    totalDistance,
    fuelCount: fuelEntries.length,
    totalFuelAmount,
    totalFuelCost,
    totalRepairCost,
    totalCleaningCost,
    totalCost,
    avgConsumption,
    costPerKm,
    avgPricePerUnit,
  };
}

export type MonthlyCost = {
  month: string; // YYYY-MM
  fuel: number;
  repair: number;
  cleaning: number;
};

export function monthlyCostSeries(data: VehicleData): MonthlyCost[] {
  const map = new Map<string, MonthlyCost>();
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const bucket = (d: Date) => {
    const k = key(d);
    if (!map.has(k)) map.set(k, { month: k, fuel: 0, repair: 0, cleaning: 0 });
    return map.get(k)!;
  };

  for (const f of data.fuelEntries) bucket(f.date).fuel += f.totalCost;
  for (const r of data.repairEntries) bucket(r.date).repair += r.cost;
  for (const c of data.cleaningEntries) bucket(c.date).cleaning += c.cost;

  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}
