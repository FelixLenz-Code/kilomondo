import { Gauge, Route, Fuel, Wallet, Droplets, TrendingDown, ArrowDown, ArrowUp, Receipt } from "lucide-react";
import { requireUser, vehicleAccessWhere } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  computeStats,
  consumptionSeries,
  monthlyCostSeries,
  fuelPriceSeries,
  fuelExtremes,
  yearlyCostSeries,
  consumptionUnit,
  fuelUnit,
} from "@/lib/stats";
import { tireWearSeries } from "@/lib/tires";
import { StatCard } from "@/components/stat-card";
import { ConsumptionChart } from "@/components/charts/consumption-chart";
import { CostChart } from "@/components/charts/cost-chart";
import { PriceChart } from "@/components/charts/price-chart";
import { TireWearCard } from "@/components/charts/tire-wear-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, formatKm, formatNumber } from "@/lib/utils";

export default async function VehicleDashboard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const vehicle = await db.vehicle.findFirst({
    where: { id, ...vehicleAccessWhere(user.id) },
    include: {
      fuelEntries: true,
      odometerEntries: true,
      repairEntries: true,
      cleaningEntries: true,
      expenses: true,
      tireSets: true,
      tireMeasurements: true,
    },
  });
  if (!vehicle) return null;

  const data = {
    vehicle,
    fuelEntries: vehicle.fuelEntries,
    odometerEntries: vehicle.odometerEntries,
    repairEntries: vehicle.repairEntries,
    cleaningEntries: vehicle.cleaningEntries,
    expenses: vehicle.expenses,
  };
  const stats = computeStats(data);
  const cunit = consumptionUnit(vehicle);
  const funit = fuelUnit(vehicle);

  const consData = consumptionSeries(data).map((p, i) => ({
    label: `#${i + 1}`,
    consumption: Number(p.consumption.toFixed(2)),
  }));
  const costData = monthlyCostSeries(data).map((m) => ({
    month: m.month.slice(2), // YY-MM
    fuel: Number(m.fuel.toFixed(2)),
    repair: Number(m.repair.toFixed(2)),
    cleaning: Number(m.cleaning.toFixed(2)),
    other: Number(m.other.toFixed(2)),
  }));
  const priceData = fuelPriceSeries(data).map((p) => ({
    label: formatDate(p.date).slice(0, 6), // TT.MM
    price: Number(p.price.toFixed(3)),
  }));
  const extremes = fuelExtremes(data);
  const yearly = yearlyCostSeries(data);
  const tireWear =
    vehicle.tireTracking && vehicle.tireMeasurements.length > 0
      ? tireWearSeries(vehicle.tireSets, vehicle.tireMeasurements)
      : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Kilometerstand"
          value={formatKm(stats.currentOdometer)}
          sub={`${formatKm(stats.totalDistance)} gefahren`}
          icon={Gauge}
        />
        <StatCard
          label="Ø Verbrauch"
          value={
            stats.avgConsumption != null
              ? `${formatNumber(stats.avgConsumption, 2)} ${cunit}`
              : "—"
          }
          sub={`${stats.fuelCount} Tankungen`}
          icon={TrendingDown}
        />
        <StatCard
          label="Kosten / km"
          value={
            stats.costPerKm != null
              ? `${formatNumber(stats.costPerKm, 3)} €`
              : "—"
          }
          sub={`${formatCurrency(stats.totalCost)} gesamt`}
          icon={Wallet}
        />
        <StatCard
          label="Kraftstoff gesamt"
          value={`${formatNumber(stats.totalFuelAmount, 1)} ${funit}`}
          sub={
            stats.avgPricePerUnit != null
              ? `Ø ${formatNumber(stats.avgPricePerUnit, 3)} €/${funit}`
              : undefined
          }
          icon={Droplets}
        />
        <StatCard
          label="Kraftstoffkosten"
          value={formatCurrency(stats.totalFuelCost)}
          icon={Fuel}
        />
        <StatCard
          label="Werkstatt & Pflege"
          value={formatCurrency(stats.totalRepairCost + stats.totalCleaningCost)}
          sub={`${formatCurrency(stats.totalRepairCost)} / ${formatCurrency(
            stats.totalCleaningCost
          )}`}
          icon={Route}
        />
        {stats.totalExpenseCost > 0 && (
          <StatCard
            label="Steuer, Versicherung & Co."
            value={formatCurrency(stats.totalExpenseCost)}
            icon={Receipt}
          />
        )}
        {extremes.cheapest && (
          <StatCard
            label="Günstigste Tankung"
            value={`${formatNumber(extremes.cheapest.price, 3)} €/${funit}`}
            sub={formatDate(extremes.cheapest.date)}
            icon={ArrowDown}
          />
        )}
        {extremes.priciest && (
          <StatCard
            label="Teuerste Tankung"
            value={`${formatNumber(extremes.priciest.price, 3)} €/${funit}`}
            sub={formatDate(extremes.priciest.date)}
            icon={ArrowUp}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Verbrauch ({cunit})</CardTitle>
          </CardHeader>
          <CardContent>
            <ConsumptionChart data={consData} unit={cunit} />
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader>
            <CardTitle>Kosten pro Monat</CardTitle>
          </CardHeader>
          <CardContent>
            <CostChart data={costData} />
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader>
            <CardTitle>Spritpreis-Verlauf (€/{funit})</CardTitle>
          </CardHeader>
          <CardContent>
            <PriceChart data={priceData} unit={funit} />
          </CardContent>
        </Card>
        {tireWear && (
          <TireWearCard sets={tireWear.sets} lines={tireWear.lines} data={tireWear.data} />
        )}
      </div>

      {yearly.length > 0 && (
        <Card className="glass">
          <CardHeader>
            <CardTitle>Jahresübersicht</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Jahr</th>
                  <th className="py-2 pr-4 text-right font-medium">Sprit</th>
                  <th className="py-2 pr-4 text-right font-medium">Werkstatt</th>
                  <th className="py-2 pr-4 text-right font-medium">Pflege</th>
                  <th className="py-2 pr-4 text-right font-medium">Sonstiges</th>
                  <th className="py-2 pr-4 text-right font-medium">Gesamt</th>
                  <th className="py-2 pr-4 text-right font-medium">Strecke</th>
                  <th className="py-2 text-right font-medium">€/km</th>
                </tr>
              </thead>
              <tbody>
                {yearly.map((y) => (
                  <tr key={y.year} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-4 font-medium">{y.year}</td>
                    <td className="py-2 pr-4 text-right">
                      {formatCurrency(y.fuel + y.adblue)}
                    </td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(y.repair)}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(y.cleaning)}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(y.other)}</td>
                    <td className="py-2 pr-4 text-right font-medium">
                      {formatCurrency(y.total)}
                    </td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">
                      {y.distance > 0 ? formatKm(y.distance) : "—"}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">
                      {y.costPerKm != null ? `${formatNumber(y.costPerKm, 3)} €` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
