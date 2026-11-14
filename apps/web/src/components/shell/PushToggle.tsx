"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";

type State = "loading" | "unsupported" | "install" | "denied" | "off" | "on";

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function post(action: string, subscription: PushSubscription): Promise<Response> {
  return fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ action, subscription: subscription.toJSON() }),
  });
}

/** Mitteilungen für dieses Gerät. Auf dem iPhone geht das nur in der App vom Home-Bildschirm. */
export function PushToggle() {
  const toast = useToast();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  const detect = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      setState(ios && !standalone ? "install" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") return setState("denied");
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return setState("unsupported");
    setState((await reg.pushManager.getSubscription()) ? "on" : "off");
  }, []);

  useEffect(() => {
    void detect().catch(() => setState("unsupported"));
  }, [detect]);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const res = await fetch("/api/push", { cache: "no-store" });
      if (!res.ok) throw new Error("Der Schlüssel konnte nicht geladen werden");
      const { publicKey } = (await res.json()) as { publicKey: string };
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      const saved = await post("subscribe", sub);
      if (!saved.ok) {
        await sub.unsubscribe();
        throw new Error("Das Gerät konnte nicht angemeldet werden");
      }
      setState("on");
      toast.success("Mitteilungen eingeschaltet");
    } catch (e) {
      toast.error("Mitteilungen nicht eingeschaltet", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await post("unsubscribe", sub);
        await sub.unsubscribe();
      }
      setState("off");
      toast.success("Mitteilungen ausgeschaltet");
    } catch (e) {
      toast.error("Ausschalten fehlgeschlagen", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setState("off");
        return;
      }
      const res = await post("test", sub);
      if (res.status === 409) {
        // The server no longer knows this device, sign it up again.
        await post("subscribe", sub);
        const again = await post("test", sub);
        if (!again.ok) throw new Error("Der Push-Dienst hat die Meldung nicht angenommen");
      } else if (!res.ok) {
        throw new Error("Der Push-Dienst hat die Meldung nicht angenommen");
      }
      toast.success("Testmeldung ist unterwegs");
    } catch (e) {
      toast.error("Testmeldung nicht gesendet", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="m-sec" style={{ gap: 8 }}>
      <h2 className="m-h">Mitteilungen</h2>
      {state === "loading" && <p className="m-note">Wird geprüft.</p>}
      {state === "install" && (
        <p className="m-note">Auf dem iPhone gehen Mitteilungen nur in der installierten App. In Safari auf Teilen tippen, dann „Zum Home-Bildschirm“, und Mesh von dort öffnen.</p>
      )}
      {state === "unsupported" && <p className="m-note">Dieser Browser unterstützt hier keine Mitteilungen.</p>}
      {state === "denied" && <p className="m-note">Mitteilungen sind für Mesh gesperrt. In den Einstellungen des Geräts unter Mitteilungen lässt sich das für Mesh wieder erlauben.</p>}
      {state === "off" && (
        <>
          <p className="m-note">Mesh meldet sich nur bei Dringendem, also bei Störungen und Sicherheit. Updates lösen keine Mitteilung aus.</p>
          <button type="button" className="m-btn p" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={enable}>
            {busy ? "Wird eingerichtet" : "Auf diesem Gerät einschalten"}
          </button>
        </>
      )}
      {state === "on" && (
        <>
          <p className="m-note">Eingeschaltet auf diesem Gerät. Gemeldet wird nur Dringendes, ein Dienst erst nach drei Minuten Ausfall.</p>
          <div className="m-act">
            <button type="button" className="m-btn p" disabled={busy} onClick={test}>Testmeldung senden</button>
            <button type="button" className="m-btn" disabled={busy} onClick={disable}>Ausschalten</button>
          </div>
        </>
      )}
    </section>
  );
}
