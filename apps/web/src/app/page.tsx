// Never statically pre-render — auth state and config depend on runtime cookies
// and the live config file. Build-time defaults would incorrectly trigger the
// setup redirect (firstRunCompleted=false in default config).
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { DashboardFooter } from "@/components/layout/DashboardFooter";
import { PinnedServicesSection } from "@/components/services/PinnedServicesSection";
import { InfraNodeGrid } from "@/components/infra/InfraNodeGrid";
import { CameraSection } from "@/components/cameras/CameraSection";
import { MainSections } from "@/components/layout/MainSections";
import { EditModeProvider } from "@/components/layout/EditModeContext";
import { EditModeBar } from "@/components/layout/EditModeBar";
import { AuthBanner } from "@/components/layout/AuthBanner";
import { ThemeSync } from "@/components/layout/ThemeSync";
import { Providers } from "@/components/providers";
import { BoardGrid } from "@/components/grid/BoardGrid";
import { CommandOverview } from "@/components/layout/CommandOverview";
import { LandingPage } from "@/components/layout/LandingPage";
import { readConfig, readConfigForBuild } from "@/server/config/store";
import { getStrategy } from "@/server/auth";

export default async function DashboardPage() {
  // Build-safe read for layout data + first-run check
  const buildCfg = readConfigForBuild();

  // Setup redirect: only on a truly fresh install (no users, never completed).
  // If users exist OR auth mode is oauth2, the config is not a fresh install
  // even if firstRunCompleted was somehow reset (e.g. by a stale backup restore).
  const freshInstall =
    !buildCfg.meta.firstRunCompleted &&
    buildCfg.auth.users.length === 0 &&
    buildCfg.auth.mode !== "oauth2";
  if (freshInstall) {
    redirect("/setup");
  }

  let homeBoardId: string | undefined = buildCfg.boards.find((b) => b.isHome)?.id;
  let showCommandOverview = buildCfg.layout.showCommandOverview;
  let authed = true;

  // Runtime auth check — readConfig() throws during `next build`, which is fine
  // because the page is dynamic (uses cookies()) and won't run at build time.
  try {
    const cfg = readConfig();
    homeBoardId = cfg.boards.find((b) => b.isHome)?.id;
    showCommandOverview = cfg.layout.showCommandOverview;

    if (cfg.auth.mode !== "open") {
      const cookieStore = await cookies();
      const cookieMap = new Map(cookieStore.getAll().map((c) => [c.name, c.value]));
      const strategy = getStrategy(cfg.auth);
      const result = await strategy.verify(undefined, cookieMap);
      authed = result.ok;
    }
  } catch {
    // Build phase or misconfiguration — render dashboard with defaults
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
      <Suspense fallback={null}>
        <EditModeProvider>
          <div className="app-layout">
            <ThemeSync />
            <Suspense fallback={null}>
              <DashboardHeader />
            </Suspense>

            <Suspense fallback={null}>
              <AuthBanner />
            </Suspense>

            <Suspense fallback={null}>
              <EditModeBar />
            </Suspense>

            <main className="main-content">
              {showCommandOverview ? (
                <Suspense fallback={null}>
                  <CommandOverview />
                </Suspense>
              ) : null}

              <Suspense fallback={null}>
                <MainSections
                  infra={
                    <Suspense fallback={null}>
                      <InfraNodeGrid boardId={homeBoardId} />
                    </Suspense>
                  }
                  services={
                    <Suspense fallback={null}>
                      <PinnedServicesSection boardId={homeBoardId} />
                    </Suspense>
                  }
                  cameras={
                    <Suspense fallback={null}>
                      <CameraSection boardId={homeBoardId} />
                    </Suspense>
                  }
                />
              </Suspense>

              <Suspense fallback={null}>
                <BoardGrid boardId={homeBoardId} />
              </Suspense>
            </main>

            <Suspense fallback={null}>
              <DashboardFooter />
            </Suspense>
          </div>
        </EditModeProvider>
      </Suspense>
    </Providers>
  );
}
