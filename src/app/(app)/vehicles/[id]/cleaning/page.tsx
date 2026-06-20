import { requireUser, vehicleAccessWhere, getVehicleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { createCleaningAction, updateCleaningAction, deleteCleaningAction } from "@/actions/entries";
import { CleaningForm } from "@/components/forms/entry-forms";
import { DeleteButton } from "@/components/delete-button";
import { EditableRow } from "@/components/editable-row";
import { BeforeAfter } from "@/components/before-after";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatKm } from "@/lib/utils";

const typeLabel: Record<string, string> = {
  FULL: "Komplett",
  EXTERIOR: "Außen",
  INTERIOR: "Innen",
};

export default async function CleaningPage({
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
    include: { cleaningEntries: { orderBy: [{ date: "desc" }] } },
  });
  if (!vehicle) return null;

  const images = await db.image.findMany({
    where: { cleaningId: { in: vehicle.cleaningEntries.map((c) => c.id) } },
    select: { id: true, cleaningId: true, kind: true },
    orderBy: { createdAt: "asc" },
  });
  const imageMap = new Map<string, { before: string[]; after: string[] }>();
  for (const im of images) {
    if (!im.cleaningId) continue;
    const m = imageMap.get(im.cleaningId) ?? { before: [], after: [] };
    (im.kind === "BEFORE" ? m.before : m.after).push(im.id);
    imageMap.set(im.cleaningId, m);
  }

  return (
    <div className={canEdit ? "grid gap-6 lg:grid-cols-[420px_1fr]" : "space-y-6"}>
      {canEdit && (
        <Card className="glass h-fit">
          <CardHeader>
            <CardTitle>Neuer Pflege-Eintrag</CardTitle>
          </CardHeader>
          <CardContent>
            <CleaningForm action={createCleaningAction.bind(null, id)} />
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardHeader>
          <CardTitle>Pflegebuch ({vehicle.cleaningEntries.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {vehicle.cleaningEntries.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Einträge.
            </p>
          )}
          {vehicle.cleaningEntries.map((c) => (
            <EditableRow
              key={c.id}
              meta={<span className="font-medium">{formatCurrency(c.cost)}</span>}
              edit={
                canEdit ? (
                  <CleaningForm
                    action={updateCleaningAction.bind(null, id, c.id)}
                    defaults={{
                      date: c.date.toISOString().slice(0, 10),
                      type: c.type,
                      cost: c.cost,
                      odometer: c.odometer,
                      products: c.products,
                      notes: c.notes,
                    }}
                  />
                ) : undefined
              }
              deleteButton={
                canEdit ? (
                  <DeleteButton action={deleteCleaningAction.bind(null, id, c.id)} />
                ) : undefined
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{typeLabel[c.type]}</Badge>
                <span className="text-sm text-muted-foreground">
                  {formatDate(c.date)}
                  {c.odometer ? ` · ${formatKm(c.odometer)}` : ""}
                </span>
              </div>
              {c.products && (
                <p className="mt-1 text-sm text-muted-foreground">{c.products}</p>
              )}
              {c.notes && (
                <p className="mt-1 text-sm text-muted-foreground">{c.notes}</p>
              )}
              <BeforeAfter
                before={imageMap.get(c.id)?.before ?? []}
                after={imageMap.get(c.id)?.after ?? []}
              />
            </EditableRow>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
