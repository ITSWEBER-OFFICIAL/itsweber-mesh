import { Suspense } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { DashboardFooter } from "@/components/layout/DashboardFooter";
import { ServicesBrowser } from "@/components/services/ServicesBrowser";
import { EditModeProvider } from "@/components/layout/EditModeContext";
import { AuthBanner } from "@/components/layout/AuthBanner";
import { ThemeSync } from "@/components/layout/ThemeSync";
import { Providers } from "@/components/providers";

export const metadata = {
  title: "Services · ITSWEBER Mesh",
};

/* v17: dedicated /services route — replaces the old "tabs filter" approach.
   Hosts the full service launcher with search + category filter + grid. */
export default function ServicesPage() {
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

            <main className="main-content">
              <Suspense fallback={null}>
                <ServicesBrowser />
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
