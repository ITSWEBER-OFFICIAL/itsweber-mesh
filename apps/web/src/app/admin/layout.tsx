// Admin layout validates auth server-side per request — must not be pre-rendered.
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Providers } from "@/components/providers";
import { ThemeSync } from "@/components/layout/ThemeSync";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { EditModeProvider } from "@/components/layout/EditModeContext";
import { AdminSidebar } from "./AdminSidebar";
import { readConfig } from "@/server/config/store";
import { getStrategy } from "@/server/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Server-side auth check — redirect to /login if not authenticated.
  // The Edge middleware already handles the case of a missing session cookie.
  // This server-side check is an additional guard for invalid/stale cookies
  // that passed the cookie-presence check in the middleware.
  let cfg;
  try {
    cfg = readConfig();
  } catch {
    // Build phase or missing config — allow rendering (tRPC enforces auth per procedure)
    cfg = null;
  }

  if (cfg && cfg.auth.mode !== "open") {
    try {
      const cookieStore = await cookies();
      const cookieMap = new Map(cookieStore.getAll().map((c) => [c.name, c.value]));
      const strategy = getStrategy(cfg.auth);
      const result = await strategy.verify(undefined, cookieMap);
      if (!result.ok) {
        redirect("/login");
      }
    } catch {
      // Unexpected error during verification (e.g. malformed cookie) — treat as invalid session
      redirect("/login");
    }
  }

  return (
    <Providers>
      <Suspense fallback={null}>
        <ThemeSync />
      </Suspense>
      <EditModeProvider>
        <div className="app-layout admin-app-layout">
          <Suspense fallback={null}>
            <DashboardHeader />
          </Suspense>

          <main className="main-content admin-main-content">
            <div className="admin-body">
              <AdminSidebar />
              <div className="admin-pane">{children}</div>
            </div>
          </main>
        </div>
      </EditModeProvider>
    </Providers>
  );
}
