"use client";

import { useEffect } from "react";

/** Registers the shell service worker. Production only, a dev server changes its files too often. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // No service worker is not an error for the user: the app works without it.
    });
  }, []);
  return null;
}
