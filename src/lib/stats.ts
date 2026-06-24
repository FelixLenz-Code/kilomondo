import type {
  CleaningEntry,
  Expense,
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
  // Optional general costs (tax, insurance, fees). Older callers may omit this.
  expenses?: Expense[];
};

export type VehicleStats = {
  currentOdometer: number;
  totalDistance: number;
  fuelCount: number;
  totalFuelAmount: number;
  totalFuelCost: number;
  totalRepairCost: number;
  totalCleaningCost: number;
  totalExpenseCost: number;
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
  const totalExpenseCost = (data.expenses ?? []).reduce((s, e) => s + e.amount, 0);
  const totalCost =
    totalFuelCost + totalAdblueCost + totalRepairCost + totalCleaningCost + totalExpenseCost;

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
    totalExpenseCost,
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
  other: number; // tax, insurance, fees (Expense rows)
};

export type FuelPricePoint = {
  date: string; // ISO date
  price: number; // price per unit paid at this fill
};

/**
 * Price per unit paid over time (every car/canister fill), oldest first.
 * Useful to visualise how fuel/energy prices developed.
 */
export function fuelPriceSeries(data: VehicleData): FuelPricePoint[] {
  return [...data.fuelEntries]
    .filter((f) => f.pricePerUnit > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((f) => ({ date: f.date.toISOString(), price: f.pricePerUnit }));
}

export type FuelExtremes = {
  cheapest: { price: number; date: string } | null;
  priciest: { price: number; date: string } | null;
};

/** Cheapest and most expensive price per unit ever paid. */
export function fuelExtremes(data: VehicleData): FuelExtremes {
  const fills = data.fuelEntries.filter((f) => f.pricePerUnit > 0);
  if (fills.length === 0) return { cheapest: null, priciest: null };
  let cheapest = fills[0];
  let priciest = fills[0];
  for (const f of fills) {
    if (f.pricePerUnit < cheapest.pricePerUnit) cheapest = f;
    if (f.pricePerUnit > priciest.pricePerUnit) priciest = f;
  }
  return {
    cheapest: { price: cheapest.pricePerUnit, date: cheapest.date.toISOString() },
    priciest: { price: priciest.pricePerUnit, date: priciest.date.toISOString() },
  };
}

export type YearlyCost = {
  year: number;
  fuel: number;
  adblue: number;
  repair: number;
  cleaning: number;
  other: number; // tax, insurance, fees
  total: number;
  distance: number; // km driven within the year (best-effort from odometer log)
  costPerKm: number | null;
};

/**
 * Per-year cost breakdown plus distance driven that year. Distance is derived
 * from the cumulative-max odometer at each year boundary, so it tolerates
 * out-of-order and partial odometer data.
 */
export function yearlyCostSeries(data: VehicleData): YearlyCost[] {
  const { vehicle, fuelEntries, repairEntries, cleaningEntries, odometerEntries } = data;

  const map = new Map<number, YearlyCost>();
  const bucket = (year: number) => {
    if (!map.has(year)) {
      map.set(year, {
        year,
        fuel: 0,
        adblue: 0,
        repair: 0,
        cleaning: 0,
        other: 0,
        total: 0,
        distance: 0,
        costPerKm: null,
      });
    }
    return map.get(year)!;
  };

  for (const f of fuelEntries) {
    const b = bucket(f.date.getFullYear());
    b.fuel += f.totalCost;
    b.adblue += f.adbluePrice ?? 0;
  }
  for (const r of repairEntries) bucket(r.date.getFullYear()).repair += r.cost;
  for (const c of cleaningEntries) bucket(c.date.getFullYear()).cleaning += c.cost;
  for (const e of data.expenses ?? []) bucket(e.date.getFullYear()).other += e.amount;

  // Odometer readings with a date, used to estimate distance per year.
  const odoPoints: { date: Date; odometer: number }[] = [
    ...fuelEntries.map((f) => ({ date: f.date, odometer: f.odometer })),
    ...odometerEntries.map((o) => ({ date: o.date, odometer: o.odometer })),
    ...repairEntries.flatMap((r) => (r.odometer != null ? [{ date: r.date, odometer: r.odometer }] : [])),
    ...cleaningEntries.flatMap((c) => (c.odometer != null ? [{ date: c.date, odometer: c.odometer }] : [])),
  ];

  const years = [...map.keys()].sort((a, b) => a - b);
  // Cumulative-max odometer at the end of a given year.
  const odoAtYearEnd = (year: number): number | null => {
    const cutoff = new Date(year + 1, 0, 1).getTime();
    let max: number | null = null;
    for (const p of odoPoints) {
      if (p.date.getTime() < cutoff && (max == null || p.odometer > max)) max = p.odometer;
    }
    return max;
  };

  for (const year of years) {
    const b = map.get(year)!;
    b.total = b.fuel + b.adblue + b.repair + b.cleaning + b.other;
    const end = odoAtYearEnd(year);
    const prevEnd = odoAtYearEnd(year - 1) ?? vehicle.initialOdometer;
    if (end != null && end > prevEnd) b.distance = end - prevEnd;
    b.costPerKm = b.distance > 0 ? b.total / b.distance : null;
  }

  return years.map((y) => map.get(y)!).reverse(); // newest year first
}

export function monthlyCostSeries(data: VehicleData): MonthlyCost[] {
  const map = new Map<string, MonthlyCost>();
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const bucket = (d: Date) => {
    const k = key(d);
    if (!map.has(k)) map.set(k, { month: k, fuel: 0, repair: 0, cleaning: 0, other: 0 });
    return map.get(k)!;
  };

  for (const f of data.fuelEntries) bucket(f.date).fuel += f.totalCost;
  for (const r of data.repairEntries) bucket(r.date).repair += r.cost;
  for (const c of data.cleaningEntries) bucket(c.date).cleaning += c.cost;
  for (const e of data.expenses ?? []) bucket(e.date).other += e.amount;

  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}
