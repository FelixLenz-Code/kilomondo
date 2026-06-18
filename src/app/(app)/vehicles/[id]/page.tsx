import { Gauge, Route, Fuel, Wallet, Droplets, TrendingDown } from "lucide-react";
import { requireUser, vehicleAccessWhere } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  computeStats,
  consumptionSeries,
  monthlyCostSeries,
  consumptionUnit,
  fuelUnit,
} from "@/lib/stats";
import { StatCard } from "@/components/stat-card";
import { ConsumptionChart } from "@/components/charts/consumption-chart";
import { CostChart } from "@/components/charts/cost-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatKm, formatNumber } from "@/lib/utils";

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
    },
  });
  if (!vehicle) return null;

  const data = {
    vehicle,
    fuelEntries: vehicle.fuelEntries,
    odometerEntries: vehicle.odometerEntries,
    repairEntries: vehicle.repairEntries,
    cleaningEntries: vehicle.cleaningEntries,
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
  }));

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
      </div>
    </div>
  );
}
