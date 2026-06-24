import { FileText, BellRing } from "lucide-react";
import { requireUser, vehicleAccessWhere, getVehicleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  documentCategoryLabel,
  documentExpiryStatus,
  type ExpiryStatus,
} from "@/lib/documents";
import {
  createDocumentAction,
  updateDocumentAction,
  deleteDocumentAction,
} from "@/actions/documents";
import { DocumentForm } from "@/components/forms/document-form";
import { DeleteButton } from "@/components/delete-button";
import { EditableRow } from "@/components/editable-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

const expiryBadge: Record<
  ExpiryStatus,
  { label: (d: string) => string; variant: "default" | "secondary" | "outline"; className?: string }
> = {
  expired: {
    label: (d) => `Abgelaufen (${d})`,
    variant: "outline",
    className: "border-destructive/60 text-destructive",
  },
  soon: { label: (d) => `Läuft ab: ${d}`, variant: "default" },
  ok: { label: (d) => `Gültig bis ${d}`, variant: "secondary" },
};

export default async function DocumentsPage({
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
    include: { documents: { orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }] } },
  });
  if (!vehicle) return null;

  const docIds = vehicle.documents.map((d) => d.id);
  const attachments = docIds.length
    ? await db.attachment.findMany({
        where: { documentId: { in: docIds } },
        select: { id: true, fileName: true, documentId: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const filesByDoc = new Map<string, { id: string; fileName: string }[]>();
  for (const a of attachments) {
    if (!a.documentId) continue;
    const arr = filesByDoc.get(a.documentId) ?? [];
    arr.push({ id: a.id, fileName: a.fileName });
    filesByDoc.set(a.documentId, arr);
  }

  return (
    <div className={canEdit ? "grid gap-6 lg:grid-cols-[380px_1fr]" : "space-y-6"}>
      {canEdit && (
        <Card className="glass h-fit">
          <CardHeader>
            <CardTitle>Neues Dokument</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentForm action={createDocumentAction.bind(null, id)} />
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardHeader>
          <CardTitle>Handschuhfach ({vehicle.documents.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {vehicle.documents.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Dokumente abgelegt.
            </p>
          )}
          {vehicle.documents.map((d) => {
            const files = filesByDoc.get(d.id) ?? [];
            const status = documentExpiryStatus(d.expiresAt);
            return (
              <EditableRow
                key={d.id}
                align="center"
                meta={
                  <span className="text-sm text-muted-foreground">
                    {documentCategoryLabel(d.category)}
                  </span>
                }
                edit={
                  canEdit ? (
                    <DocumentForm
                      action={updateDocumentAction.bind(null, id, d.id)}
                      defaults={{
                        title: d.title,
                        category: d.category,
                        issueDate: d.issueDate,
                        expiresAt: d.expiresAt,
                        notes: d.notes,
                        remind: d.reminderId != null,
                        leadDays: 28,
                        files,
                      }}
                    />
                  ) : undefined
                }
                deleteButton={
                  canEdit ? (
                    <DeleteButton action={deleteDocumentAction.bind(null, id, d.id)} />
                  ) : undefined
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="font-medium">{d.title}</span>
                  {status && d.expiresAt && (
                    <Badge
                      variant={expiryBadge[status].variant}
                      className={expiryBadge[status].className}
                    >
                      {expiryBadge[status].label(formatDate(d.expiresAt))}
                    </Badge>
                  )}
                  {d.reminderId && (
                    <Badge variant="secondary">
                      <BellRing className="mr-1 size-3" /> Erinnerung
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {d.issueDate && <span>Ausgestellt: {formatDate(d.issueDate)}</span>}
                  {files.map((f) => (
                    <a
                      key={f.id}
                      href={`/api/attachments/${f.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 underline hover:text-foreground"
                    >
                      <FileText className="size-3" /> {f.fileName}
                    </a>
                  ))}
                  {d.notes && <span>{d.notes}</span>}
                </div>
              </EditableRow>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
