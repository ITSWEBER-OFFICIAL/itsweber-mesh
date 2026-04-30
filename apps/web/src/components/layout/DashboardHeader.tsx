"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, LayoutGrid } from "lucide-react";
import { LiveClock } from "./LiveClock";
import { SystemBadge } from "./SystemBadge";
import { HeaderSearch } from "./HeaderSearch";
import { BoardSwitcher } from "./BoardSwitcher";
import { trpc } from "@/lib/trpc-client";
import { useEditMode } from "./EditModeContext";

const NAV_ROUTES = [
  { href: "/",         label: "Dashboard" },
  { href: "/services", label: "Services" },
] as const;

export function DashboardHeader() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const { active: editMode, enter: enterEditMode } = useEditMode();

  const { data: settings } = trpc.settings.get.useQuery(undefined, { staleTime: 60_000 });
  const showSystemBadge = settings?.layout.showSystemBadge ?? true;
  /* CommandOverview already shows the time prominently in its title bar.
     If the banner is enabled, hide the header clock to avoid duplication. */
  const showHeaderClock = !(settings?.layout.showCommandOverview ?? true);
  const dashboardName = settings?.meta.name ?? "ITSWEBER";
  const subtitle = settings?.meta.subtitle ?? "Home Infrastructure";

  return (
    <header className="app-header">
      <Link href="/" className="logo-wrap">
        <div className="logo-mark-box">
          <span className="logo-mark-shine" />
          <Image
            src="/logo-mesh-mark.svg"
            alt={dashboardName}
            width={24}
            height={24}
            className="logo-mark-img"
          />
        </div>
        <div>
          <div className="logo-name">{dashboardName}</div>
          <div className="logo-sub">{subtitle}</div>
        </div>
      </Link>

      <BoardSwitcher />

      <nav className="app-nav">
        {NAV_ROUTES.map((route) => {
          const active = route.href === "/"
            ? pathname === "/"
            : pathname === route.href || pathname.startsWith(route.href + "/");
          return (
            <Link
              key={route.href}
              href={route.href}
              className={`nav-pill ${active ? "nav-pill-active" : ""}`}
            >
              {route.label}
            </Link>
          );
        })}
      </nav>

      <div className="header-right">
        <HeaderSearch />
        {showSystemBadge && <SystemBadge />}
        {!isAdmin && (
          <button
            type="button"
            onClick={enterEditMode}
            disabled={editMode}
            className={`edit-mode-toggle ${editMode ? "edit-mode-toggle-active" : ""}`}
            title="Anordnung bearbeiten"
          >
            <LayoutGrid size={13} />
            <span>Anordnung</span>
          </button>
        )}
        {showHeaderClock && <LiveClock />}
        <Link
          href="/admin"
          className={`admin-gear-btn ${isAdmin ? "admin-gear-btn-active" : ""}`}
          title="Admin"
          aria-label="Admin"
        >
          <Settings size={16} />
        </Link>
      </div>
    </header>
  );
}
