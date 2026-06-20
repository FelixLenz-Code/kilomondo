import { requireUser, vehicleAccessWhere, getVehicleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { createRepairAction, updateRepairAction, deleteRepairAction } from "@/actions/entries";
import { RepairForm } from "@/components/forms/entry-forms";
import { DeleteButton } from "@/components/delete-button";
import { EditableRow } from "@/components/editable-row";
import { BeforeAfter } from "@/components/before-after";
import { AttachmentList } from "@/components/attachment-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatKm } from "@/lib/utils";

const categoryLabel: Record<string, string> = {
  REPAIR: "Reparatur",
  SERVICE: "Service",
  INSPECTION: "HU/AU",
  TIRES: "Reifen",
  OTHER: "Sonstiges",
};

export default async function RepairsPage({
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
    include: { repairEntries: { orderBy: [{ date: "desc" }] } },
  });
  if (!vehicle) return null;

  const repairIds = vehicle.repairEntries.map((r) => r.id);
  const images = await db.image.findMany({
    where: { repairId: { in: repairIds } },
    select: { id: true, repairId: true, kind: true },
    orderBy: { createdAt: "asc" },
  });
  const imageMap = new Map<string, { before: string[]; after: string[] }>();
  for (const im of images) {
    if (!im.repairId) continue;
    const m = imageMap.get(im.repairId) ?? { before: [], after: [] };
    (im.kind === "BEFORE" ? m.before : m.after).push(im.id);
    imageMap.set(im.repairId, m);
  }

  const attachments = await db.attachment.findMany({
    where: { repairId: { in: repairIds } },
    select: { id: true, repairId: true, fileName: true },
    orderBy: { createdAt: "asc" },
  });
  const attachmentMap = new Map<string, { id: string; fileName: string }[]>();
  for (const a of attachments) {
    if (!a.repairId) continue;
    const list = attachmentMap.get(a.repairId) ?? [];
    list.push({ id: a.id, fileName: a.fileName });
    attachmentMap.set(a.repairId, list);
  }

  return (
    <div className={canEdit ? "grid gap-6 lg:grid-cols-[420px_1fr]" : "space-y-6"}>
      {canEdit && (
        <Card className="glass h-fit">
          <CardHeader>
            <CardTitle>Neuer Eintrag</CardTitle>
          </CardHeader>
          <CardContent>
            <RepairForm action={createRepairAction.bind(null, id)} />
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardHeader>
          <CardTitle>Reparaturbuch ({vehicle.repairEntries.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {vehicle.repairEntries.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Einträge.
            </p>
          )}
          {vehicle.repairEntries.map((r) => {
            const entryAttachments = attachmentMap.get(r.id) ?? [];
            return (
              <EditableRow
                key={r.id}
                meta={<span className="font-medium">{formatCurrency(r.cost)}</span>}
                edit={
                  canEdit ? (
                    <RepairForm
                      action={updateRepairAction.bind(null, id, r.id)}
                      defaults={{
                        date: r.date.toISOString().slice(0, 10),
                        category: r.category,
                        title: r.title,
                        cost: r.cost,
                        odometer: r.odometer,
                        workshop: r.workshop,
                        description: r.description,
                        attachments: entryAttachments,
                      }}
                    />
                  ) : undefined
                }
                deleteButton={
                  canEdit ? (
                    <DeleteButton action={deleteRepairAction.bind(null, id, r.id)} />
                  ) : undefined
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.title}</span>
                  <Badge variant="secondary">{categoryLabel[r.category]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(r.date)}
                  {r.odometer ? ` · ${formatKm(r.odometer)}` : ""}
                  {r.workshop ? ` · ${r.workshop}` : ""}
                </p>
                {r.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
                )}
                <BeforeAfter
                  before={imageMap.get(r.id)?.before ?? []}
                  after={imageMap.get(r.id)?.after ?? []}
                />
                <AttachmentList attachments={entryAttachments} />
              </EditableRow>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
