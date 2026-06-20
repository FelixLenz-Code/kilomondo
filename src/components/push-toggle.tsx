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

type Availability = "checking" | "ok" | "insecure" | "unsupported";

export function PushToggle() {
  const [availability, setAvailability] = useState<Availability>("checking");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Push needs a secure context (https or localhost). Over http://<ip> the
    // browser hides the service-worker/push APIs entirely.
    if (!window.isSecureContext) {
      setAvailability("insecure");
      return;
    }
    const ok =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!ok) {
      setAvailability("unsupported");
      return;
    }
    setAvailability("ok");
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  async function enable() {
    setBusy(true);
    setMsg({});
    try {
      if (Notification.permission === "denied") {
        setMsg({
          error:
            "Benachrichtigungen sind für diese Seite blockiert. Erlaube sie in den Browser-/Seiteneinstellungen und versuche es erneut.",
        });
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMsg({ error: "Keine Berechtigung erteilt." });
        return;
      }

      // Make sure a service worker is registered, then wait for it to become
      // active — but don't hang forever if activation stalls (navigator.
      // serviceWorker.ready never resolves without an active worker).
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) reg = await navigator.serviceWorker.register("/sw.js");
      const active = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);
      reg = active ?? reg;
      if (!reg?.pushManager) {
        setMsg({
          error:
            "Service Worker nicht aktiv. Lade die Seite neu (ggf. einmal die App schließen/öffnen) und versuche es erneut.",
        });
        return;
      }

      const res = await fetch("/api/push/vapid-public-key");
      if (!res.ok) {
        setMsg({ error: `VAPID-Schlüssel nicht erhalten (HTTP ${res.status}).` });
        return;
      }
      const { key } = (await res.json()) as { key: string };

      let sub: PushSubscription;
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });
      } catch (e) {
        const err = e as Error;
        setMsg({
          error:
            `Push-Abo fehlgeschlagen (${err.name}: ${err.message}). ` +
            "Häufigste Ursache: Brave blockiert den Push-Dienst standardmäßig — aktiviere in " +
            "brave://settings/privacy „Google-Dienste für Push-Nachrichten verwenden\" (Android: " +
            "Einstellungen → Datenschutz) und starte den Browser neu. Alternativ Chrome oder Firefox nutzen.",
        });
        return;
      }

      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
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
    } catch (e) {
      const err = e as Error;
      setMsg({ error: `Aktivierung fehlgeschlagen (${err.name}: ${err.message}).` });
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

  if (availability === "insecure") {
    return (
      <p className="text-sm text-muted-foreground">
        Push-Benachrichtigungen brauchen eine <strong>sichere Verbindung (HTTPS)</strong>.
        Über <code>http://</code> mit einer IP-Adresse blockiert der Browser sie.
        Rufe die App über <code>https://</code> auf (z. B. hinter einem Reverse-Proxy
        mit TLS) — oder zum Testen über <code>http://localhost</code> auf dem Server selbst.
      </p>
    );
  }

  if (availability === "unsupported") {
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
          <Button type="button" onClick={enable} disabled={busy || availability === "checking"} className="flex-1">
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
