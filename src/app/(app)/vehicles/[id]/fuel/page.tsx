import { requireUser, vehicleAccessWhere, getVehicleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { fuelUnit } from "@/lib/stats";
import { canisterState } from "@/lib/canister";
import { createFuelAction, updateFuelAction, deleteFuelAction } from "@/actions/entries";
import { createCanisterPourAction } from "@/actions/canisters";
import { FuelForm, CanisterPourForm } from "@/components/forms/entry-forms";
import { CanisterPanel, type CanisterView } from "@/components/canister-panel";
import { DeleteButton } from "@/components/delete-button";
import { EditableRow } from "@/components/editable-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatKm, formatNumber } from "@/lib/utils";

export default async function FuelPage({
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
    include: { fuelEntries: { orderBy: [{ date: "desc" }, { odometer: "desc" }] } },
  });
  if (!vehicle) return null;
  const unit = fuelUnit(vehicle) as "L" | "kWh";

  // Canisters belong to the vehicle's owner (shared across their vehicles), so
  // a shared editor sees and uses the owner's canisters, not their own.
  const ownerId = access?.ownerId ?? user.id;
  const canisterRows = await db.canister.findMany({
    where: { userId: ownerId },
    orderBy: { createdAt: "asc" },
  });
  const canisters: CanisterView[] = await Promise.all(
    canisterRows.map(async (c) => {
      const s = await canisterState(c.id);
      return {
        id: c.id,
        name: c.name,
        capacity: c.capacity,
        fuelType: c.fuelType,
        liters: s?.liters ?? 0,
        value: s?.value ?? 0,
        avgPrice: s?.avgPrice ?? 0,
      };
    })
  );
  const canisterName = new Map(canisters.map((c) => [c.id, c.name]));
  const pourable = canisters
    .filter((c) => c.liters > 0)
    .map((c) => ({ id: c.id, name: c.name, liters: c.liters }));

  return (
    <div className={canEdit ? "grid gap-6 lg:grid-cols-[380px_1fr]" : "space-y-6"}>
      {canEdit && (
        <div className="space-y-6">
          <Card className="glass h-fit">
            <CardHeader>
              <CardTitle>Neue Tankung</CardTitle>
            </CardHeader>
            <CardContent>
              <FuelForm
                action={createFuelAction.bind(null, id)}
                unit={unit}
                vehicleId={id}
                canisters={canisters.map((c) => ({
                  id: c.id,
                  name: c.name,
                  capacity: c.capacity,
                  currentLiters: c.liters,
                }))}
              />
            </CardContent>
          </Card>

          {pourable.length > 0 && (
            <Card className="glass h-fit">
              <CardHeader>
                <CardTitle>Aus Kanister nachfüllen</CardTitle>
              </CardHeader>
              <CardContent>
                <CanisterPourForm
                  action={createCanisterPourAction.bind(null, id)}
                  canisters={pourable}
                  unit={unit}
                />
              </CardContent>
            </Card>
          )}

          <Card className="glass h-fit">
            <CardHeader>
              <CardTitle>Kanister</CardTitle>
            </CardHeader>
            <CardContent>
              <CanisterPanel vehicleId={id} unit={unit} canisters={canisters} />
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="glass">
        <CardHeader>
          <CardTitle>Tankbuch ({vehicle.fuelEntries.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {vehicle.fuelEntries.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Tankungen erfasst.
            </p>
          )}
          {vehicle.fuelEntries.map((f) => (
            <EditableRow
              key={f.id}
              align="center"
              meta={<span className="font-medium">{formatCurrency(f.totalCost)}</span>}
              edit={
                canEdit ? (
                  <FuelForm
                    action={updateFuelAction.bind(null, id, f.id)}
                    unit={unit}
                    defaults={{
                      date: f.date.toISOString().slice(0, 10),
                      odometer: f.odometer,
                      amount: f.amount,
                      pricePerUnit: f.pricePerUnit,
                      totalCost: f.totalCost,
                      isFullTank: f.isFullTank,
                      station: f.station,
                      notes: f.notes,
                    }}
                  />
                ) : undefined
              }
              deleteButton={
                canEdit ? (
                  <DeleteButton action={deleteFuelAction.bind(null, id, f.id)} />
                ) : undefined
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{formatDate(f.date)}</span>
                <span className="text-sm text-muted-foreground">{formatKm(f.odometer)}</span>
                {f.kind === "CANISTER" && (
                  <Badge variant="secondary">
                    Kanister
                    {f.canisterId && canisterName.has(f.canisterId)
                      ? `: ${canisterName.get(f.canisterId)}`
                      : ""}
                  </Badge>
                )}
                {f.isFullTank && <Badge variant="secondary">Voll</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {formatNumber(f.amount, 2)} {unit}
                {f.station ? ` · ${f.station}` : ""}
              </p>
            </EditableRow>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
