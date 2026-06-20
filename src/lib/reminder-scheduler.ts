import "server-only";
import { db } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";
import { backfillLogRemindersOnce } from "@/lib/reminder-suggestions";
import { formatDate } from "@/lib/utils";

const KM_LEAD = 500; // notify when within this many km of a mileage due
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
const daysSince = (date: Date, now: Date) => (now.getTime() - date.getTime()) / DAY;
const daysUntil = (date: Date, now: Date) => (date.getTime() - now.getTime()) / DAY;

async function vehicleState(vehicleId: string, initialOdometer: number) {
  const [fuelOdo, odoOdo, lastFuel, lastOdo, lastRepair, lastClean] = await Promise.all([
    db.fuelEntry.aggregate({ where: { vehicleId }, _max: { odometer: true } }),
    db.odometerEntry.aggregate({ where: { vehicleId }, _max: { odometer: true } }),
    db.fuelEntry.aggregate({ where: { vehicleId }, _max: { date: true } }),
    db.odometerEntry.aggregate({ where: { vehicleId }, _max: { date: true } }),
    db.repairEntry.aggregate({ where: { vehicleId }, _max: { date: true } }),
    db.cleaningEntry.aggregate({ where: { vehicleId }, _max: { date: true } }),
  ]);
  const currentOdometer = Math.max(
    initialOdometer,
    fuelOdo._max.odometer ?? 0,
    odoOdo._max.odometer ?? 0
  );
  const dates = [lastFuel._max.date, lastOdo._max.date, lastRepair._max.date, lastClean._max.date]
    .filter((d): d is Date => d != null)
    .map((d) => d.getTime());
  const lastEntryDate = dates.length ? new Date(Math.max(...dates)) : null;
  return { currentOdometer, lastEntryDate };
}

/**
 * Evaluate all active reminders and push the ones that are due to the vehicle
 * owner. Idempotent: each reminder is guarded by lastNotifiedAt, so running it
 * repeatedly (hourly) won't spam. Returns the number of notifications sent.
 */
export async function runDueReminders(now = new Date()): Promise<number> {
  const reminders = await db.reminder.findMany({
    where: { active: true },
    include: {
      vehicle: {
        select: { id: true, name: true, userId: true, initialOdometer: true, createdAt: true },
      },
    },
  });

  const stateCache = new Map<string, Awaited<ReturnType<typeof vehicleState>>>();
  let sent = 0;

  for (const r of reminders) {
    const v = r.vehicle;
    let st = stateCache.get(v.id);
    if (!st) {
      st = await vehicleState(v.id, v.initialOdometer);
      stateCache.set(v.id, st);
    }

    let due = false;
    let body = "";

    if (r.type === "LOG") {
      const interval = r.intervalDays ?? 30;
      const last = st.lastEntryDate ?? v.createdAt;
      const since = daysSince(last, now);
      if (since >= interval && (!r.lastNotifiedAt || daysSince(r.lastNotifiedAt, now) >= interval)) {
        due = true;
        body = `${r.title}: seit ${Math.floor(since)} Tagen kein Eintrag.`;
      }
    } else if (r.dueDate) {
      const notifyFrom = new Date(r.dueDate.getTime() - r.leadDays * DAY);
      if (now >= notifyFrom && (!r.lastNotifiedAt || r.lastNotifiedAt < notifyFrom)) {
        const d = Math.ceil(daysUntil(r.dueDate, now));
        body =
          d >= 0
            ? `${r.title}: fällig in ${d} Tag(en) (${formatDate(r.dueDate)}).`
            : `${r.title}: überfällig seit ${formatDate(r.dueDate)}.`;
        due = true;
      }
    } else if (r.dueOdometer != null) {
      const remaining = r.dueOdometer - st.currentOdometer;
      if (remaining <= KM_LEAD && (!r.lastNotifiedAt || daysSince(r.lastNotifiedAt, now) >= 14)) {
        body =
          remaining > 0
            ? `${r.title}: noch ~${remaining} km bis ${r.dueOdometer} km.`
            : `${r.title}: ${r.dueOdometer} km erreicht.`;
        due = true;
      }
    }

    if (due) {
      sent += await sendPushToUser(v.userId, {
        title: v.name,
        body,
        url: `/vehicles/${v.id}/reminders`,
        tag: `reminder-${r.id}`,
      });
      await db.reminder.update({ where: { id: r.id }, data: { lastNotifiedAt: now } });
    }

    // Recurring date reminders: once past due, roll the date forward so it
    // fires again next cycle.
    if (r.dueDate && r.recurrenceMonths && now > r.dueDate) {
      let next = new Date(r.dueDate);
      while (next <= now) next = addMonths(next, r.recurrenceMonths);
      await db.reminder.update({ where: { id: r.id }, data: { dueDate: next, lastNotifiedAt: null } });
    }
  }

  return sent;
}

/**
 * Start the in-process daily scheduler. Single container = single scheduler;
 * a global guard prevents duplicate timers across dev HMR reloads.
 */
export function startReminderScheduler(): void {
  const g = globalThis as unknown as { __carlogReminderTimer?: NodeJS.Timeout };
  if (g.__carlogReminderTimer) return;
  // Shortly after startup: backfill default LOG reminders (once), then check.
  setTimeout(() => {
    void backfillLogRemindersOnce()
      .then(() => runDueReminders())
      .catch(() => {});
  }, 30_000);
  g.__carlogReminderTimer = setInterval(() => void runDueReminders().catch(() => {}), HOUR);
}
