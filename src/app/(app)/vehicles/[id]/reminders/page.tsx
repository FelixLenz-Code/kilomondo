import { requireUser, vehicleAccessWhere, getVehicleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  createReminderAction,
  deleteReminderAction,
  toggleReminderAction,
} from "@/actions/reminders";
import { ReminderForm } from "@/components/forms/reminder-form";
import { DeleteButton } from "@/components/delete-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatKm } from "@/lib/utils";

const typeLabel: Record<string, string> = {
  INSPECTION: "HU/AU",
  SERVICE: "Wartung",
  INSURANCE: "Versicherung",
  TAX: "Steuer",
  LOG: "Eintragen",
  CUSTOM: "Sonstiges",
};

function dueText(r: {
  type: string;
  dueDate: Date | null;
  dueOdometer: number | null;
  intervalDays: number | null;
  leadDays: number;
  recurrenceMonths: number | null;
}): string {
  if (r.type === "LOG") return `wenn ${r.intervalDays ?? 30} Tage kein Eintrag`;
  const parts: string[] = [];
  if (r.dueDate) parts.push(`fällig ${formatDate(r.dueDate)}`);
  if (r.dueOdometer != null) parts.push(`bei ${formatKm(r.dueOdometer)}`);
  parts.push(`${r.leadDays} Tage Vorlauf`);
  if (r.recurrenceMonths) parts.push(`alle ${r.recurrenceMonths} Mon.`);
  return parts.join(" · ");
}

export default async function RemindersPage({
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
    include: { reminders: { orderBy: [{ active: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }] } },
  });
  if (!vehicle) return null;

  return (
    <div className={canEdit ? "grid gap-6 lg:grid-cols-[420px_1fr]" : "space-y-6"}>
      {canEdit && (
        <Card className="glass h-fit">
          <CardHeader>
            <CardTitle>Neue Erinnerung</CardTitle>
          </CardHeader>
          <CardContent>
            <ReminderForm action={createReminderAction.bind(null, id)} />
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardHeader>
          <CardTitle>Termine & Erinnerungen ({vehicle.reminders.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {vehicle.reminders.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Erinnerungen. Lege z. B. HU/AU oder die nächste Wartung an.
            </p>
          )}
          {vehicle.reminders.map((r) => (
            <div
              key={r.id}
              className={`flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/40 p-3 ${
                r.active ? "" : "opacity-60"
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.title}</span>
                  <Badge variant="secondary">{typeLabel[r.type]}</Badge>
                  {!r.active && <Badge variant="outline">pausiert</Badge>}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{dueText(r)}</p>
              </div>
              {canEdit && (
                <div className="flex shrink-0 items-center gap-1">
                  <form action={toggleReminderAction.bind(null, id, r.id)}>
                    <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                      {r.active ? "Pausieren" : "Aktivieren"}
                    </Button>
                  </form>
                  <DeleteButton action={deleteReminderAction.bind(null, id, r.id)} />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
