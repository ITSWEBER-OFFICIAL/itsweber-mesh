"use client";

import { useEffect } from "react";

const MIN_INTERVAL_MS = 10 * 60 * 1000;

/** Keeps the login alive while the app is in use: asks the server to renew the
 *  session when the app opens or returns to the foreground. If the session is
 *  gone, the page reloads once so the login screen appears instead of a shell
 *  whose requests all fail. */
export function SessionKeepAlive() {
  useEffect(() => {
    let last = 0;
    let stopped = false;
    const renew = () => {
      if (stopped || document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - last < MIN_INTERVAL_MS) return;
      last = now;
      fetch("/api/auth/session/renew", { method: "POST", credentials: "same-origin", cache: "no-store" })
        .then((res) => {
          if (res.status === 401 && !stopped) {
            stopped = true;
            window.location.reload();
          }
        })
        .catch(() => {
          // Offline or server restarting: try again on the next foreground event.
          last = 0;
        });
    };
    renew();
    document.addEventListener("visibilitychange", renew);
    const timer = window.setInterval(renew, MIN_INTERVAL_MS);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", renew);
      window.clearInterval(timer);
    };
  }, []);
  return null;
}
