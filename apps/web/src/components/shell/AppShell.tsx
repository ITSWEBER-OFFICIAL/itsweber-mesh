"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthBanner } from "@/components/layout/AuthBanner";
import { useMeshData } from "./useMeshData";

/* Mesh 2.0: one shell for every page. Floating pill below 1024 px, rail from 1024 px. */

const ICONS = {
  start: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.2" /></>,
  dienste: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="3.25" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="3.25" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
  server: (
    <>
      <rect x="4" y="4.5" width="16" height="6" rx="2" />
      <rect x="4" y="13.5" width="16" height="6" rx="2" />
      <path d="M7.5 7.5h.01M7.5 16.5h.01" />
    </>
  ),
  hinweise: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" /><path d="M10 20.5h4" /></>,
  mehr: <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="2.6" />,
  suche: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
  pfeil: <path d="m9 6 6 6-6 6" />,
} as const;

export function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className="m-i" viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const NAV = [
  { href: "/", icon: "start", label: "Start" },
  { href: "/services", icon: "dienste", label: "Dienste" },
  { href: "/server", icon: "server", label: "Server" },
  { href: "/hinweise", icon: "hinweise", label: "Hinweise" },
  { href: "/mehr", icon: "mehr", label: "Mehr" },
] as const;

function NavLinks({ withLabel }: { withLabel: boolean }) {
  const pathname = usePathname() ?? "/";
  const { overview } = useMeshData();
  return (
    <>
      {NAV.map((n) => {
        const active =
          n.href === "/"
            ? pathname === "/"
            : pathname === n.href ||
              pathname.startsWith(n.href + "/") ||
              (n.href === "/mehr" && (pathname.startsWith("/admin") || pathname.startsWith("/boards")));
        const badge = n.href === "/hinweise" && overview.bad > 0 ? overview.bad : 0;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            aria-label={badge ? `${n.label}, ${badge} dringend` : n.label}
            title={withLabel ? undefined : n.label}
          >
            <Icon name={n.icon} />
            {withLabel && <span>{n.label}</span>}
            {badge > 0 && <em className="m-badge" aria-hidden="true">{badge}</em>}
          </Link>
        );
      })}
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="m-app">
      <AuthBanner />
      <nav className="m-rail" aria-label="Hauptnavigation">
        <NavLinks withLabel={false} />
      </nav>
      <main className="m-main">{children}</main>
      <nav className="m-pill" aria-label="Hauptnavigation">
        <NavLinks withLabel />
      </nav>
    </div>
  );
}

/** Kanzel (Petrol-Kopf) und Deck. Jede Seite im Gerüst nutzt denselben Aufbau. */
export function Screen({
  title,
  context,
  brand,
  small,
  kanzel,
  children,
}: {
  title: string;
  context?: string | undefined;
  brand?: boolean;
  small?: boolean;
  kanzel?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="m-screen">
      <header className={`m-kanzel ${small ? "sm" : ""}`}>
        <div className="m-top">
          <h1 className="m-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {brand && <img src="/icons/app-icon-96.png" alt="" width={28} height={28} />}
            {title}
          </h1>
          {context && <span className="m-ctx">{context}</span>}
        </div>
        {kanzel}
      </header>
      <div className="m-deck">{children}</div>
    </div>
  );
}

const DOT_LABEL = { ok: "Läuft", bad: "Störung", warn: "Achtung", unknown: "Ungeprüft" } as const;

export function Dot({ state }: { state: keyof typeof DOT_LABEL }) {
  return <i className={`m-dot ${state === "ok" ? "" : state}`} role="img" aria-label={DOT_LABEL[state]} />;
}
