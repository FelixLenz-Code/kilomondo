import "server-only";

// In-memory throttle for failed logins. The app runs as a single Node process
// (one container), so a module-level map is sufficient; it intentionally does
// not survive restarts. Keyed per client so one attacker can't lock out others.
type Bucket = { count: number; first: number; blockedUntil: number };

const WINDOW_MS = 10 * 60 * 1000; // attempts are counted within this window
const MAX_ATTEMPTS = 8; // failures allowed per window before blocking
const BLOCK_MS = 10 * 60 * 1000; // how long a block lasts

const buckets = new Map<string, Bucket>();

function sweep(now: number) {
  // Opportunistic cleanup so the map can't grow unbounded.
  if (buckets.size < 5000) return;
  for (const [key, b] of buckets) {
    if (b.blockedUntil < now && now - b.first > WINDOW_MS) buckets.delete(key);
  }
}

/** Returns how long the key must wait (ms), or 0 if a login attempt is allowed. */
export function loginRetryAfterMs(key: string, now = Date.now()): number {
  const b = buckets.get(key);
  if (!b) return 0;
  if (b.blockedUntil > now) return b.blockedUntil - now;
  return 0;
}

/** Record a failed login; blocks the key once it exceeds the window allowance. */
export function recordLoginFailure(key: string, now = Date.now()): void {
  sweep(now);
  const b = buckets.get(key);
  if (!b || now - b.first > WINDOW_MS) {
    buckets.set(key, { count: 1, first: now, blockedUntil: 0 });
    return;
  }
  b.count += 1;
  if (b.count >= MAX_ATTEMPTS) b.blockedUntil = now + BLOCK_MS;
}

/** Clear a key's history after a successful login. */
export function recordLoginSuccess(key: string): void {
  buckets.delete(key);
}
