import "server-only";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export type ReminderSuggestion = {
  type: "INSPECTION" | "SERVICE";
  title: string;
  dueDate: string; // yyyy-mm-dd
  recurrenceMonths: number;
  reason: string;
};

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const monthsBetween = (a: Date, b: Date) =>
  (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

/** Advance a (possibly past) due date forward to the next upcoming occurrence. */
function nextOccurrence(due: Date, recurrenceMonths: number, now: Date): Date {
  let next = new Date(due);
  while (next < now) next = addMonths(next, recurrenceMonths);
  return next;
}

const LOG_BACKFILL_FLAG = "log_reminder_backfill_done";

/**
 * Ensure a vehicle has the default "don't forget to log entries" reminder
 * (notify after 30 days without any entry). No-op if a LOG reminder already
 * exists, so a deliberately deleted one isn't recreated.
 */
export async function ensureLogReminder(vehicleId: string): Promise<void> {
  const existing = await db.reminder.findFirst({ where: { vehicleId, type: "LOG" } });
  if (existing) return;
  await db.reminder.create({
    data: {
      vehicleId,
      type: "LOG",
      title: "Eintragen nicht vergessen",
      intervalDays: 30,
      source: "AUTO",
    },
  });
}

/**
 * One-time backfill so vehicles created before this feature also get the
 * default LOG reminder. Guarded by an AppSetting flag so it runs once ever and
 * never resurrects reminders a user later deletes.
 */
export async function backfillLogRemindersOnce(): Promise<void> {
  const done = await db.appSetting.findUnique({ where: { key: LOG_BACKFILL_FLAG } });
  if (done) return;
  const vehicles = await db.vehicle.findMany({ select: { id: true } });
  for (const v of vehicles) await ensureLogReminder(v.id);
  await db.appSetting
    .create({ data: { key: LOG_BACKFILL_FLAG, value: new Date().toISOString() } })
    .catch(() => {});
}

/**
 * Auto-create or refresh the HU/AU reminder from the vehicle's inspection
 * history (latest INSPECTION entry + 24 months, rolled to the next upcoming
 * date). Called when an HU/AU repair entry is added or edited. Leaves a
 * user-created (MANUAL) reminder untouched so it doesn't override manual edits.
 */
export async function syncInspectionReminder(vehicleId: string): Promise<void> {
  const latest = await db.repairEntry.aggregate({
    where: { vehicleId, category: "INSPECTION" },
    _max: { date: true },
  });
  const lastDate = latest._max.date;
  if (!lastDate) return;

  const due = nextOccurrence(addMonths(lastDate, 24), 24, new Date());
  const existing = await db.reminder.findFirst({
    where: { vehicleId, type: "INSPECTION" },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    if (existing.source !== "AUTO") return; // respect a manually managed reminder
    await db.reminder.update({
      where: { id: existing.id },
      data: { dueDate: due, recurrenceMonths: 24, active: true, lastNotifiedAt: null },
    });
  } else {
    await db.reminder.create({
      data: {
        vehicleId,
        type: "INSPECTION",
        title: "HU/AU (TÜV)",
        dueDate: due,
        leadDays: 28,
        recurrenceMonths: 24,
        source: "AUTO",
      },
    });
  }
}

/**
 * Estimate due dates from history: HU/AU from the last inspection (+24 months)
 * and the next service from the average interval between past services. Skips a
 * suggestion when an active reminder of that type already exists.
 */
export async function suggestReminders(vehicleId: string): Promise<ReminderSuggestion[]> {
  const now = new Date();
  const [inspections, services, existing] = await Promise.all([
    db.repairEntry.findMany({
      where: { vehicleId, category: "INSPECTION" },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
    db.repairEntry.findMany({
      where: { vehicleId, category: "SERVICE" },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
    db.reminder.findMany({ where: { vehicleId, active: true }, select: { type: true } }),
  ]);
  const have = new Set(existing.map((e) => e.type));
  const out: ReminderSuggestion[] = [];

  if (inspections.length && !have.has("INSPECTION")) {
    const last = inspections[inspections.length - 1].date;
    const due = nextOccurrence(addMonths(last, 24), 24, now);
    out.push({
      type: "INSPECTION",
      title: "HU/AU (TÜV)",
      dueDate: isoDay(due),
      recurrenceMonths: 24,
      reason: `Letzte HU/AU am ${formatDate(last)} + 24 Monate`,
    });
  }

  if (services.length && !have.has("SERVICE")) {
    const last = services[services.length - 1].date;
    let interval = 12;
    let reason = `Letzte Wartung am ${formatDate(last)} + 12 Monate`;
    if (services.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < services.length; i++) {
        gaps.push(monthsBetween(services[i - 1].date, services[i].date));
      }
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      interval = Math.min(60, Math.max(3, Math.round(avg)));
      reason = `Ø-Intervall ~${interval} Monate aus ${services.length} Wartungen`;
    }
    const due = nextOccurrence(addMonths(last, interval), interval, now);
    out.push({
      type: "SERVICE",
      title: "Wartung / Inspektion",
      dueDate: isoDay(due),
      recurrenceMonths: interval,
      reason,
    });
  }

  return out;
}
