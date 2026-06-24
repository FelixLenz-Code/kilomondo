import { redirect } from "next/navigation";
import { CircleDot, Snowflake, Sun, CalendarSync } from "lucide-react";
import { requireUser, vehicleAccessWhere, getVehicleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { summariseTireSets, tireSeasonLabel } from "@/lib/tires";
import {
  createTireSetAction,
  updateTireSetAction,
  deleteTireSetAction,
  createTireChangeAction,
  deleteTireChangeAction,
} from "@/actions/tires";
import { TireSetForm, TireChangeForm } from "@/components/forms/tire-forms";
import { DeleteButton } from "@/components/delete-button";
import { EditableRow } from "@/components/editable-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatKm, formatNumber } from "@/lib/utils";

export default async function TiresPage({
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
      tireSets: { orderBy: { createdAt: "asc" } },
      tireChanges: { orderBy: [{ odometer: "desc" }, { date: "desc" }] },
    },
  });
  if (!vehicle) return null;
  if (!vehicle.tireTracking) redirect(`/vehicles/${id}`);

  // Current odometer: the highest reading across all logs.
  const [fuelMax, odoMax, repairMax, cleanMax] = await Promise.all([
    db.fuelEntry.aggregate({ where: { vehicleId: id }, _max: { odometer: true } }),
    db.odometerEntry.aggregate({ where: { vehicleId: id }, _max: { odometer: true } }),
    db.repairEntry.aggregate({ where: { vehicleId: id }, _max: { odometer: true } }),
    db.cleaningEntry.aggregate({ where: { vehicleId: id }, _max: { odometer: true } }),
  ]);
  const currentOdometer = Math.max(
    vehicle.initialOdometer,
    fuelMax._max.odometer ?? 0,
    odoMax._max.odometer ?? 0,
    repairMax._max.odometer ?? 0,
    cleanMax._max.odometer ?? 0,
    ...vehicle.tireChanges.map((c) => c.odometer)
  );

  const summaries = summariseTireSets(vehicle.tireSets, vehicle.tireChanges, currentOdometer);
  const activeSets = summaries.filter((s) => !s.retired);
  const setName = new Map(vehicle.tireSets.map((s) => [s.id, s.name]));
  const SeasonIcon = (season: string) =>
    season === "WINTER" ? Snowflake : season === "ALLSEASON" ? CircleDot : Sun;

  return (
    <div className={canEdit ? "grid gap-6 lg:grid-cols-[380px_1fr]" : "space-y-6"}>
      {canEdit && (
        <div className="space-y-6">
          <Card className="glass h-fit">
            <CardHeader>
              <CardTitle>Neuer Radsatz</CardTitle>
            </CardHeader>
            <CardContent>
              <TireSetForm action={createTireSetAction.bind(null, id)} />
            </CardContent>
          </Card>

          <Card className="glass h-fit">
            <CardHeader>
              <CardTitle>Radwechsel erfassen</CardTitle>
            </CardHeader>
            <CardContent>
              <TireChangeForm
                action={createTireChangeAction.bind(null, id)}
                sets={activeSets.map((s) => ({ id: s.id, name: s.name }))}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-6">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Radsätze ({vehicle.tireSets.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {vehicle.tireSets.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Noch keine Radsätze angelegt.
              </p>
            )}
            {summaries.map((s) => {
              const Icon = SeasonIcon(s.season);
              return (
                <EditableRow
                  key={s.id}
                  align="center"
                  meta={
                    <span className="text-sm text-muted-foreground">
                      {formatKm(s.mountedKm)}
                    </span>
                  }
                  edit={
                    canEdit ? (
                      <TireSetForm
                        action={updateTireSetAction.bind(null, id, s.id)}
                        defaults={{
                          name: s.name,
                          season: s.season,
                          dimension: s.dimension,
                          brand: s.brand,
                          purchaseDate: s.purchaseDate,
                          treadDepthMm: s.treadDepthMm,
                          storageLocation: s.storageLocation,
                          retired: s.retired,
                          notes: s.notes,
                        }}
                      />
                    ) : undefined
                  }
                  deleteButton={
                    canEdit ? (
                      <DeleteButton action={deleteTireSetAction.bind(null, id, s.id)} />
                    ) : undefined
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="font-medium">{s.name}</span>
                    <Badge variant="secondary">{tireSeasonLabel(s.season)}</Badge>
                    {s.isCurrent && <Badge>Aufgezogen</Badge>}
                    {s.retired && <Badge variant="secondary">Ausgemustert</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[
                      s.dimension,
                      s.brand,
                      s.treadDepthMm != null
                        ? `${formatNumber(s.treadDepthMm, 1)} mm Profil`
                        : null,
                      s.storageLocation,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </EditableRow>
              );
            })}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Wechsel-Historie ({vehicle.tireChanges.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {vehicle.tireChanges.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Noch keine Radwechsel erfasst.
              </p>
            )}
            {vehicle.tireChanges.map((c) => (
              <EditableRow
                key={c.id}
                align="center"
                meta={
                  <span className="text-sm text-muted-foreground">
                    {formatKm(c.odometer)}
                  </span>
                }
                deleteButton={
                  canEdit ? (
                    <DeleteButton action={deleteTireChangeAction.bind(null, id, c.id)} />
                  ) : undefined
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <CalendarSync className="size-4 text-muted-foreground" />
                  <span className="font-medium">{formatDate(c.date)}</span>
                  <Badge variant="secondary">
                    {setName.get(c.tireSetId) ?? "Unbekannt"}
                  </Badge>
                </div>
                {c.notes && (
                  <p className="text-sm text-muted-foreground">{c.notes}</p>
                )}
              </EditableRow>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
