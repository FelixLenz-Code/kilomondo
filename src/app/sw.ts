/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

// --- Web Push ---------------------------------------------------------------

type PushPayload = { title?: string; body?: string; url?: string; tag?: string };

// Show a notification when a push arrives (fires even when the app is closed).
self.addEventListener("push", (event) => {
  let data: PushPayload = {};
  try {
    if (event.data) data = event.data.json() as PushPayload;
  } catch {
    if (event.data) data = { body: event.data.text() };
  }
  const title = data.title ?? "Car Log";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url ?? "/" },
    })
  );
});

// Focus an existing window (or open one) at the notification's target URL.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url ?? "/";
  event.waitUntil(
    (async () => {
      const clients = (await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      })) as readonly WindowClient[];
      const target = new URL(url, self.location.origin).href;
      for (const client of clients) {
        await client.focus();
        if (client.url !== target) await client.navigate(url).catch(() => {});
        return;
      }
      await self.clients.openWindow(url);
    })()
  );
});
