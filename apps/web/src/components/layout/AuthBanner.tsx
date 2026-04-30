"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldAlert, X } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

/**
 * Renders a warning banner whenever auth.mode === "open".
 * Once auth is configured (token / userPassword / oauth2), the banner disappears.
 * User can dismiss it for the current session via state — no persistence (intentional;
 * we want the user reminded after every reload until they enable auth).
 */
export function AuthBanner() {
  const [hidden, setHidden] = useState(false);
  const { data: settings } = trpc.settings.get.useQuery();

  if (hidden) return null;
  if (!settings) return null;
  if (settings.auth.mode !== "open") return null;

  return (
    <div className="auth-banner" role="alert">
      <ShieldAlert size={16} />
      <span className="auth-banner-text">
        <strong>Admin-API ungeschützt</strong> — Auth-Mode ist aktuell <code>open</code>.
        Setze <code>ADMIN_TOKEN</code> als Environment-Variable und wähle in der{" "}
        <Link href="/admin/auth">Auth-Konfiguration</Link> den Token-Modus.
      </span>
      <button
        type="button"
        className="auth-banner-dismiss"
        onClick={() => setHidden(true)}
        aria-label="Banner ausblenden"
      >
        <X size={14} />
      </button>
    </div>
  );
}
