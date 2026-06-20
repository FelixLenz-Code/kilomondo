"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertMessage } from "@/components/ui/alert-message";
import {
  savePushSubscriptionAction,
  deletePushSubscriptionAction,
  sendTestNotificationAction,
} from "@/actions/push";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushToggle() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  async function enable() {
    setBusy(true);
    setMsg({});
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMsg({ error: "Benachrichtigungen wurden im Browser blockiert." });
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const res = await fetch("/api/push/vapid-public-key");
      if (!res.ok) throw new Error("vapid");
      const { key } = (await res.json()) as { key: string };
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const result = await savePushSubscriptionAction({
        endpoint: json.endpoint ?? "",
        keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
      });
      if (result.error) {
        setMsg({ error: result.error });
      } else {
        setSubscribed(true);
        setMsg({ success: result.success });
      }
    } catch {
      setMsg({ error: "Aktivierung fehlgeschlagen. Ist die App als PWA installiert (iOS)?" });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg({});
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe().catch(() => {});
      }
      setSubscribed(false);
      setMsg({ success: "Benachrichtigungen deaktiviert." });
    } catch {
      setMsg({ error: "Deaktivierung fehlgeschlagen." });
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMsg({});
    setMsg(await sendTestNotificationAction());
    setBusy(false);
  }

  if (supported === false) {
    return (
      <p className="text-sm text-muted-foreground">
        Dieser Browser unterstützt keine Push-Benachrichtigungen. Auf iOS musst du
        die App zuerst zum Home-Bildschirm hinzufügen.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <AlertMessage error={msg.error} success={msg.success} />
      <div className="flex flex-col gap-2 sm:flex-row">
        {subscribed ? (
          <Button type="button" variant="outline" onClick={disable} disabled={busy} className="flex-1">
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <BellOff className="mr-2 size-4" />}
            Benachrichtigungen deaktivieren
          </Button>
        ) : (
          <Button type="button" onClick={enable} disabled={busy || supported === null} className="flex-1">
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Bell className="mr-2 size-4" />}
            Benachrichtigungen aktivieren
          </Button>
        )}
        {subscribed && (
          <Button type="button" variant="outline" onClick={test} disabled={busy} className="sm:w-auto">
            <Send className="mr-2 size-4" />
            Test senden
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Gilt für dieses Gerät bzw. diesen Browser. Aktiviere es auf jedem Gerät,
        auf dem du benachrichtigt werden möchtest.
      </p>
    </div>
  );
}
