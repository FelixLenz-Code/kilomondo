import { redirect } from "next/navigation";
import { Zap, Home, Globe, Wallet } from "lucide-react";
import { requireUser, vehicleAccessWhere, getVehicleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { summariseCharging, chargingLocationLabel } from "@/lib/charging";
import {
  createChargingAction,
  updateChargingAction,
  deleteChargingAction,
} from "@/actions/charging";
import { ChargingForm } from "@/components/forms/charging-form";
import { DeleteButton } from "@/components/delete-button";
import { EditableRow } from "@/components/editable-row";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatKm, formatNumber } from "@/lib/utils";

export default async function ChargingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const access = await getVehicleAccess(id, user.id);
  const canEdit = access != null && access.level !== "VIEWER";

  const vehicle = await db.vehicle.findFirst({
    where: { id, ...vehicleAccessWhere(user.id) },
    include: {
      chargingSessions: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
    },
  });
  if (!vehicle) return null;
  if (!vehicle.evTracking) redirect(`/vehicles/${id}`);

  const sessions = vehicle.chargingSessions;
  const summary = summariseCharging(sessions);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Geladen gesamt"
          value={`${formatNumber(summary.totalKwh, 1)} kWh`}
          sub={`${summary.count} Ladevorgänge`}
          icon={Zap}
        />
        <StatCard
          label="Ladekosten"
          value={formatCurrency(summary.totalCost)}
          sub={
            summary.avgPricePerKwh != null
              ? `Ø ${formatNumber(summary.avgPricePerKwh, 3)} €/kWh`
              : undefined
          }
          icon={Wallet}
        />
        <StatCard label="Zu Hause" value={`${formatNumber(summary.homeKwh, 1)} kWh`} icon={Home} />
        <StatCard label="Öffentlich" value={`${formatNumber(summary.publicKwh, 1)} kWh`} icon={Globe} />
      </div>

      <div className={canEdit ? "grid gap-6 lg:grid-cols-[380px_1fr]" : "space-y-6"}>
        {canEdit && (
          <Card className="glass h-fit">
            <CardHeader>
              <CardTitle>Neuer Ladevorgang</CardTitle>
            </CardHeader>
            <CardContent>
              <ChargingForm action={createChargingAction.bind(null, id)} />
            </CardContent>
          </Card>
        )}

        <Card className="glass">
          <CardHeader>
            <CardTitle>Ladevorgänge ({summary.count})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Noch keine Ladevorgänge erfasst.
              </p>
            )}
            {sessions.map((s) => (
              <EditableRow
                key={s.id}
                align="center"
                meta={
                  <span className="font-medium">
                    {s.totalCost != null ? formatCurrency(s.totalCost) : "—"}
                  </span>
                }
                edit={
                  canEdit ? (
                    <ChargingForm
                      action={updateChargingAction.bind(null, id, s.id)}
                      defaults={{
                        date: s.date.toISOString().slice(0, 10),
                        odometer: s.odometer,
                        energyKwh: s.energyKwh,
                        pricePerKwh: s.pricePerKwh,
                        totalCost: s.totalCost,
                        location: s.location,
                        provider: s.provider,
                        notes: s.notes,
                      }}
                    />
                  ) : undefined
                }
                deleteButton={
                  canEdit ? (
                    <DeleteButton action={deleteChargingAction.bind(null, id, s.id)} />
                  ) : undefined
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Zap className="size-4 text-muted-foreground" />
                  <span className="font-medium">{formatDate(s.date)}</span>
                  <Badge variant="secondary">{chargingLocationLabel(s.location)}</Badge>
                  {s.provider && <Badge variant="outline">{s.provider}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatNumber(s.energyKwh, 2)} kWh
                  {s.pricePerKwh != null ? ` · ${formatNumber(s.pricePerKwh, 3)} €/kWh` : ""}
                  {s.odometer != null ? ` · ${formatKm(s.odometer)}` : ""}
                  {s.notes ? ` · ${s.notes}` : ""}
                </p>
              </EditableRow>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
