import { requireUser, vehicleAccessWhere, getVehicleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { createOdometerAction, updateOdometerAction, deleteOdometerAction } from "@/actions/entries";
import { OdometerForm } from "@/components/forms/entry-forms";
import { DeleteButton } from "@/components/delete-button";
import { EditableRow } from "@/components/editable-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatKm } from "@/lib/utils";

export default async function MileagePage({
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
    include: { odometerEntries: { orderBy: [{ date: "desc" }] } },
  });
  if (!vehicle) return null;

  return (
    <div className={canEdit ? "grid gap-6 lg:grid-cols-[380px_1fr]" : "space-y-6"}>
      {canEdit && (
        <Card className="glass h-fit">
          <CardHeader>
            <CardTitle>Kilometerstand erfassen</CardTitle>
          </CardHeader>
          <CardContent>
            <OdometerForm action={createOdometerAction.bind(null, id)} />
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardHeader>
          <CardTitle>Verlauf ({vehicle.odometerEntries.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {vehicle.odometerEntries.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Kilometerstände erfasst. (Tankungen zählen ebenfalls.)
            </p>
          )}
          {vehicle.odometerEntries.map((o) => (
            <EditableRow
              key={o.id}
              align="center"
              edit={
                canEdit ? (
                  <OdometerForm
                    action={updateOdometerAction.bind(null, id, o.id)}
                    defaults={{
                      date: o.date.toISOString().slice(0, 10),
                      odometer: o.odometer,
                      note: o.note,
                    }}
                  />
                ) : undefined
              }
              deleteButton={
                canEdit ? (
                  <DeleteButton action={deleteOdometerAction.bind(null, id, o.id)} />
                ) : undefined
              }
            >
              <span className="font-medium">{formatKm(o.odometer)}</span>
              <p className="text-sm text-muted-foreground">
                {formatDate(o.date)}
                {o.note ? ` · ${o.note}` : ""}
              </p>
            </EditableRow>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
