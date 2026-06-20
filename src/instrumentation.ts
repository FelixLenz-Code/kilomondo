// Runs once when the Next.js server starts. Kicks off the in-process reminder
// scheduler. The dynamic import sits *inside* the NEXT_RUNTIME === "nodejs"
// check so the edge build dead-code-eliminates it (the scheduler pulls in
// node-only deps like web-push that can't be bundled for the edge runtime).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startReminderScheduler } = await import("@/lib/reminder-scheduler");
    startReminderScheduler();
  }
}
