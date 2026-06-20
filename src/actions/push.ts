"use server";

import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";

export type PushActionState = { error?: string; success?: string };

type IncomingSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/** Store (or refresh) the current browser's push subscription for this user. */
export async function savePushSubscriptionAction(
  sub: IncomingSubscription
): Promise<PushActionState> {
  const user = await requireUser();
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { error: "Ungültige Push-Anmeldung." };
  }

  const h = await headers();
  const userAgent = h.get("user-agent")?.slice(0, 255) ?? null;

  // Endpoint is unique: re-subscribing or switching accounts on the same
  // browser updates the existing row to the current user.
  await db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: {
      userId: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent,
    },
    update: { userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
  });
  return { success: "Benachrichtigungen aktiviert." };
}

/** Remove this browser's subscription (on disable / unsubscribe). */
export async function deletePushSubscriptionAction(
  endpoint: string
): Promise<PushActionState> {
  const user = await requireUser();
  if (!endpoint) return {};
  await db.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return { success: "Benachrichtigungen deaktiviert." };
}

/** Send a test notification to all of the current user's devices. */
export async function sendTestNotificationAction(): Promise<PushActionState> {
  const user = await requireUser();
  const delivered = await sendPushToUser(user.id, {
    title: "Car Log — Test",
    body: "Push-Benachrichtigungen funktionieren! 🚗",
    url: "/account",
    tag: "carlog-test",
  });
  if (delivered === 0) {
    return { error: "Kein Gerät erreicht. Aktiviere Benachrichtigungen zuerst auf diesem Gerät." };
  }
  return { success: `Test gesendet an ${delivered} Gerät(e).` };
}
