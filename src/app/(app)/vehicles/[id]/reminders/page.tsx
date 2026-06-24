import { requireUser, vehicleAccessWhere, getVehicleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  createReminderAction,
  updateReminderAction,
  deleteReminderAction,
  toggleReminderAction,
  acceptReminderSuggestionAction,
} from "@/actions/reminders";
import { suggestReminders } from "@/lib/reminder-suggestions";
import { ReminderForm } from "@/components/forms/reminder-form";
import { EditableRow } from "@/components/editable-row";
import { DeleteButton } from "@/components/delete-button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { latestMinTread } from "@/lib/tires";
import { formatDate, formatKm, formatNumber } from "@/lib/utils";
import Link from "next/link";

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

/**
 * Tire-wear reminders have no date — they fire from tread measurements. Show the
 * alert threshold and the latest measured depth instead of the generic dueText.
 */
function tireDueText(t: { wearAlertMm: number | null; minTread: number | null }): string {
  const parts: string[] = [];
  if (t.minTread != null) parts.push(`Profil akt. ${formatNumber(t.minTread, 1)} mm`);
  if (t.wearAlertMm != null) parts.push(`Warnung bei ${formatNumber(t.wearAlertMm, 1)} mm`);
  return parts.length ? parts.join(" · ") : "Profilwarnung aktiv";
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

  // Tire-wear reminders are managed by their tire set (source TIRE). Pull the
  // linked sets so we can show the tread threshold/latest reading and keep the
  // row read-only here (edited under the Reifen tab).
  const tireSets = await db.tireSet.findMany({
    where: { vehicleId: id, reminderId: { not: null } },
    include: { measurements: true },
  });
  const tireByReminder = new Map(
    tireSets.map((s) => [
      s.reminderId as string,
      { wearAlertMm: s.wearAlertMm, minTread: latestMinTread(s.measurements) },
    ])
  );

  // Auto-suggestions derived from history (only useful for editors).
  const suggestions = canEdit ? await suggestReminders(id) : [];

  return (
    <div className={canEdit ? "grid gap-6 lg:grid-cols-[420px_1fr]" : "space-y-6"}>
      {canEdit && (
        <div className="space-y-6">
          <Card className="glass h-fit">
            <CardHeader>
              <CardTitle>Neue Erinnerung</CardTitle>
            </CardHeader>
            <CardContent>
              <ReminderForm action={createReminderAction.bind(null, id)} />
            </CardContent>
          </Card>

          {suggestions.length > 0 && (
            <Card className="glass h-fit">
              <CardHeader>
                <CardTitle>Vorschläge</CardTitle>
                <CardDescription>Aus deinem Verlauf geschätzt.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {suggestions.map((s) => (
                  <div
                    key={s.type}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/40 p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{s.title}</p>
                      <p className="text-sm text-muted-foreground">
                        fällig {formatDate(new Date(s.dueDate))} · alle {s.recurrenceMonths} Mon.
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{s.reason}</p>
                    </div>
                    <form action={acceptReminderSuggestionAction.bind(null, id)}>
                      <input type="hidden" name="type" value={s.type} />
                      <input type="hidden" name="title" value={s.title} />
                      <input type="hidden" name="dueDate" value={s.dueDate} />
                      <input type="hidden" name="recurrenceMonths" value={s.recurrenceMonths} />
                      <Button type="submit" size="sm" variant="outline" className="shrink-0">
                        Übernehmen
                      </Button>
                    </form>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
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
          {vehicle.reminders.map((r) => {
            const tire = r.source === "TIRE" ? tireByReminder.get(r.id) : undefined;
            return (
              <EditableRow
                key={r.id}
                edit={
                  canEdit && !tire ? (
                    <ReminderForm
                      action={updateReminderAction.bind(null, id, r.id)}
                      defaults={{
                        type: r.type,
                        title: r.title,
                        dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : "",
                        dueOdometer: r.dueOdometer,
                        leadDays: r.leadDays,
                        intervalDays: r.intervalDays,
                        recurrenceMonths: r.recurrenceMonths,
                      }}
                    />
                  ) : undefined
                }
                deleteButton={
                  canEdit ? (
                    tire ? (
                      <Link
                        href={`/vehicles/${id}/tires`}
                        className={buttonVariants({ variant: "ghost", size: "sm" }) + " text-muted-foreground hover:text-foreground"}
                      >
                        Reifen
                      </Link>
                    ) : (
                      <>
                        <form action={toggleReminderAction.bind(null, id, r.id)}>
                          <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                            {r.active ? "Pausieren" : "Aktivieren"}
                          </Button>
                        </form>
                        <DeleteButton action={deleteReminderAction.bind(null, id, r.id)} />
                      </>
                    )
                  ) : undefined
                }
              >
                <div className={r.active ? "" : "opacity-60"}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.title}</span>
                    <Badge variant="secondary">{tire ? "Reifen" : typeLabel[r.type]}</Badge>
                    {!r.active && <Badge variant="outline">pausiert</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {tire ? tireDueText(tire) : dueText(r)}
                  </p>
                </div>
              </EditableRow>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
