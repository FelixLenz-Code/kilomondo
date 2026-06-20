import "server-only";
import webpush from "web-push";
import { db } from "@/lib/db";

// VAPID keypair is generated once and persisted in the DB (AppSetting), so it
// survives restarts and updates without any .env configuration. Subscriptions
// are bound to the public key, so the key must stay stable once created.
const K_PUBLIC = "vapid_public_key";
const K_PRIVATE = "vapid_private_key";

let cached: { publicKey: string; privateKey: string } | null = null;

async function getVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  if (cached) return cached;

  const read = async () => {
    const rows = await db.appSetting.findMany({
      where: { key: { in: [K_PUBLIC, K_PRIVATE] } },
    });
    const pub = rows.find((r) => r.key === K_PUBLIC)?.value;
    const priv = rows.find((r) => r.key === K_PRIVATE)?.value;
    return pub && priv ? { publicKey: pub, privateKey: priv } : null;
  };

  let keys = await read();
  if (!keys) {
    const generated = webpush.generateVAPIDKeys();
    // skipDuplicates: if another request created them first, keep theirs.
    await db.appSetting.createMany({
      data: [
        { key: K_PUBLIC, value: generated.publicKey },
        { key: K_PRIVATE, value: generated.privateKey },
      ],
      skipDuplicates: true,
    });
    keys = (await read()) ?? generated;
  }

  cached = keys;
  return keys;
}

// VAPID "subject" must be a mailto: or https: URL identifying the sender.
function vapidSubject(): string {
  const email = process.env.ADMIN_EMAIL?.trim();
  return email ? `mailto:${email}` : "mailto:admin@car-log.app";
}

/** The public key the browser needs to create a push subscription. */
export async function getVapidPublicKey(): Promise<string> {
  return (await getVapidKeys()).publicKey;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Path to open when the notification is clicked. */
  url?: string;
  /** Collapses notifications that share a tag. */
  tag?: string;
};

/**
 * Send a notification to every registered device of a user. Returns how many
 * were delivered; subscriptions the push service reports as gone (404/410) are
 * pruned automatically.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<number> {
  const { publicKey, privateKey } = await getVapidKeys();
  webpush.setVapidDetails(vapidSubject(), publicKey, privateKey);

  const subs = await db.pushSubscription.findMany({ where: { userId } });
  let delivered = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      );
      delivered++;
    } catch (err) {
      const code = (err as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      }
      // Other errors are transient (network, rate limit) — leave the sub in place.
    }
  }
  return delivered;
}
