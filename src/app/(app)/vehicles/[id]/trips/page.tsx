import { redirect } from "next/navigation";
import { Route, ArrowRight } from "lucide-react";
import { requireUser, vehicleAccessWhere, getVehicleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { summariseTrips, tripPurposeLabel } from "@/lib/trips";
import { createTripAction, updateTripAction, deleteTripAction } from "@/actions/trips";
import { TripForm } from "@/components/forms/trip-form";
import { DeleteButton } from "@/components/delete-button";
import { EditableRow } from "@/components/editable-row";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatKm } from "@/lib/utils";

export default async function TripsPage({
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
      trips: { orderBy: [{ date: "desc" }, { startOdometer: "desc" }] },
    },
  });
  if (!vehicle) return null;
  if (!vehicle.tripLogging) redirect(`/vehicles/${id}`);

  const summary = summariseTrips(vehicle.trips);
  // Pre-fill a new trip's start km with the most recent trip's end km.
  const lastEnd = vehicle.trips.length
    ? Math.max(...vehicle.trips.map((t) => t.endOdometer))
    : undefined;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Fahrten" value={String(summary.count)} icon={Route} />
        <StatCard label="Geschäftlich" value={formatKm(summary.business)} icon={Route} />
        <StatCard label="Privat" value={formatKm(summary.private)} icon={Route} />
        <StatCard label="Arbeitsweg" value={formatKm(summary.commute)} icon={Route} />
      </div>

      <div className={canEdit ? "grid gap-6 lg:grid-cols-[380px_1fr]" : "space-y-6"}>
        {canEdit && (
          <Card className="glass h-fit">
            <CardHeader>
              <CardTitle>Neue Fahrt</CardTitle>
            </CardHeader>
            <CardContent>
              <TripForm
                action={createTripAction.bind(null, id)}
                defaultStartOdometer={lastEnd}
              />
            </CardContent>
          </Card>
        )}

        <Card className="glass">
          <CardHeader>
            <CardTitle>Fahrtenbuch ({summary.count})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {vehicle.trips.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Noch keine Fahrten erfasst.
              </p>
            )}
            {vehicle.trips.map((t) => {
              const km = Math.max(0, t.endOdometer - t.startOdometer);
              return (
                <EditableRow
                  key={t.id}
                  align="center"
                  meta={<span className="font-medium">{formatKm(km)}</span>}
                  edit={
                    canEdit ? (
                      <TripForm
                        action={updateTripAction.bind(null, id, t.id)}
                        defaults={{
                          date: t.date.toISOString().slice(0, 10),
                          startOdometer: t.startOdometer,
                          endOdometer: t.endOdometer,
                          purpose: t.purpose,
                          startLocation: t.startLocation,
                          endLocation: t.endLocation,
                          description: t.description,
                        }}
                      />
                    ) : undefined
                  }
                  deleteButton={
                    canEdit ? (
                      <DeleteButton action={deleteTripAction.bind(null, id, t.id)} />
                    ) : undefined
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{formatDate(t.date)}</span>
                    <Badge variant="secondary">{tripPurposeLabel(t.purpose)}</Badge>
                    {(t.startLocation || t.endLocation) && (
                      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                        {t.startLocation ?? "?"} <ArrowRight className="size-3" /> {t.endLocation ?? "?"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatKm(t.startOdometer)} → {formatKm(t.endOdometer)}
                    {t.description ? ` · ${t.description}` : ""}
                  </p>
                </EditableRow>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
