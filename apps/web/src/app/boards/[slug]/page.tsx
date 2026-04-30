import { Suspense } from "react";
import { notFound } from "next/navigation";
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
import { readConfig } from "@/server/config/store";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function BoardPage({ params }: Props) {
  const { slug } = await params;
  const cfg = readConfig();
  const board = cfg.boards.find((b) => b.slug === slug);
  if (!board) notFound();
  const showCommandOverview = cfg.layout.showCommandOverview;

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
                      <InfraNodeGrid boardId={board.id} />
                    </Suspense>
                  }
                  services={
                    <Suspense fallback={null}>
                      <PinnedServicesSection boardId={board.id} />
                    </Suspense>
                  }
                  cameras={
                    <Suspense fallback={null}>
                      <CameraSection boardId={board.id} />
                    </Suspense>
                  }
                />
              </Suspense>

              <Suspense fallback={null}>
                <BoardGrid boardId={board.id} />
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
