"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc-client";

// useLayoutEffect on client, useEffect on server (SSR-safe)
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Keeps the <html data-theme="..."> attribute and --brand CSS variable
 * in sync with the persisted theme config at all times — including after
 * admin changes without a full page reload.
 *
 * layout.tsx sets the initial value server-side, but Next.js caches the
 * layout across navigations, so client-side sync is required for live updates.
 */
export function ThemeSync() {
  const pathname = usePathname();

  /* v17: data-tab no longer driven by Filter-Tabs; only set "admin" so existing
     CSS that scopes to data-tab="admin" keeps working. Other routes leave it cleared. */
  useIsoLayoutEffect(() => {
    if (pathname?.startsWith("/admin")) {
      document.documentElement.setAttribute("data-tab", "admin");
    } else {
      document.documentElement.removeAttribute("data-tab");
    }
  }, [pathname]);

  const { data: settings } = trpc.settings.get.useQuery(undefined, {
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  // Theme + Custom CSS synchron anwenden, sobald Settings da sind —
  // verhindert Flash beim Wechsel /admin → /
  useIsoLayoutEffect(() => {
    if (!settings) return;
    const { preset, accent, background, customCss, backgroundPattern } = settings.theme;
    const html = document.documentElement;

    if (html.getAttribute("data-theme") !== preset) {
      html.setAttribute("data-theme", preset);
    }
    if (html.getAttribute("data-bg-pattern") !== backgroundPattern) {
      html.setAttribute("data-bg-pattern", backgroundPattern);
    }

    // Brand-Accent
    let accentEl = document.getElementById("user-accent") as HTMLStyleElement | null;
    if (!accentEl) {
      accentEl = document.createElement("style");
      accentEl.id = "user-accent";
      document.head.appendChild(accentEl);
    }
    const accentRule = `:root{--brand:${accent};}`;
    if (accentEl.innerHTML !== accentRule) {
      accentEl.innerHTML = accentRule;
    }

    // Custom CSS — reaktiv injizieren / aktualisieren / leeren
    let customEl = document.getElementById("user-custom-css") as HTMLStyleElement | null;
    if (!customEl && customCss) {
      customEl = document.createElement("style");
      customEl.id = "user-custom-css";
      document.head.appendChild(customEl);
    }
    if (customEl) {
      const next = customCss ?? "";
      if (customEl.innerHTML !== next) {
        customEl.innerHTML = next;
      }
    }

    const body = document.body;
    if (background.kind === "image" && background.src) {
      body.style.backgroundImage = `url(${JSON.stringify(background.src)})`;
      body.style.backgroundSize = "cover";
      body.style.backgroundPosition = "center";
      body.style.backgroundAttachment = "fixed";
      body.style.backgroundRepeat = "no-repeat";
    } else {
      body.style.backgroundImage = "";
      body.style.backgroundSize = "";
      body.style.backgroundPosition = "";
      body.style.backgroundAttachment = "";
      body.style.backgroundRepeat = "";
    }
  }, [settings]);

  return null;
}
