// Mesh 2.0: gemeinsames Layout für Start, Dienste, Server, Hinweise und Mehr.
// Auth state and config depend on runtime cookies and the live config file.
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Providers } from "@/components/providers";
import { ThemeSync } from "@/components/layout/ThemeSync";
import { LandingPage } from "@/components/layout/LandingPage";
import { AppShell } from "@/components/shell/AppShell";
import { readConfig, readConfigForBuild } from "@/server/config/store";
import { getStrategy } from "@/server/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const buildCfg = readConfigForBuild();

  // Setup redirect: only on a truly fresh install (no users, never completed).
  const freshInstall =
    !buildCfg.meta.firstRunCompleted &&
    buildCfg.auth.users.length === 0 &&
    buildCfg.auth.mode !== "oauth2";
  if (freshInstall) redirect("/setup");

  let authed = true;
  try {
    const cfg = readConfig();
    if (cfg.auth.mode !== "open") {
      const cookieStore = await cookies();
      const cookieMap = new Map(cookieStore.getAll().map((c) => [c.name, c.value]));
      const result = await getStrategy(cfg.auth).verify(undefined, cookieMap);
      authed = result.ok;
    }
  } catch {
    // Build phase or misconfiguration: fail closed, never render the app unauthenticated
    authed = false;
  }

  if (!authed) {
    return (
      <LandingPage
        siteName={buildCfg.meta.name}
        subtitle={buildCfg.meta.subtitle ?? ""}
        authMode={buildCfg.auth.mode}
      />
    );
  }

  return (
    <Providers>
      <ThemeSync />
      <Suspense fallback={null}>
        <AppShell>{children}</AppShell>
      </Suspense>
    </Providers>
  );
}
