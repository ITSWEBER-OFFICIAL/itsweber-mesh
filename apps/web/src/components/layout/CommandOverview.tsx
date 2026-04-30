"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc-client";
import type { AdguardWidgetData } from "@/app/api/widgets/adguard/route";
import type { SmartHomeWidgetData } from "@/app/api/widgets/smart-home/route";

const REFRESH_MS = 10_000;

function useNow(): Date {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function authModeLabel(mode: string): { value: string; meta: string } {
  switch (mode) {
    case "open":
      return { value: "Offen", meta: "kein Login · Setup empfohlen" };
    case "token":
      return { value: "Token", meta: "ADMIN_TOKEN · Cookie-Session" };
    case "userPassword":
      return { value: "User", meta: "bcrypt · Cookie-Session" };
    case "oauth2":
      return { value: "OIDC", meta: "OpenID · Group-Mapping" };
    default:
      return { value: "—", meta: mode };
  }
}

type KpiTileProps = {
  label: string;
  value: string;
  meta?: string;
  tooltip?: string;
  tone?: "default" | "ok" | "warn" | "err" | "muted";
};

function KpiTile({ label, value, meta, tooltip, tone = "default" }: KpiTileProps) {
  return (
    <div className={`cmd-kpi-tile cmd-kpi-${tone}`} title={tooltip}>
      <span className="cmd-kpi-label">{label}</span>
      <span className="cmd-kpi-value">{value}</span>
      {meta ? <span className="cmd-kpi-meta">{meta}</span> : null}
    </div>
  );
}

export function CommandOverview() {
  const { data: settings } = trpc.settings.get.useQuery(undefined, { staleTime: 60_000 });
  const { data: services = [] } = trpc.services.list.useQuery(undefined, { staleTime: 30_000 });
  const { data: status = {} } = trpc.status.all.useQuery(undefined, {
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS - 1_000,
  });

  const adguard = useQuery<AdguardWidgetData>({
    queryKey: ["cmd-adguard"],
    queryFn: () => fetch("/api/widgets/adguard").then((r) => r.json()),
    refetchInterval: 60_000,
    staleTime: 55_000,
  });

  const smartHome = useQuery<SmartHomeWidgetData>({
    queryKey: ["cmd-smart-home"],
    queryFn: () => fetch("/api/widgets/smart-home").then((r) => r.json()),
    refetchInterval: 30_000,
    staleTime: 28_000,
  });

  const now = useNow();
  const [hostname, setHostname] = useState<string>("");
  useEffect(() => {
    if (typeof window !== "undefined") setHostname(window.location.hostname);
  }, []);

  const domain = settings?.meta.domain || hostname;
  const subtitle = settings?.meta.commandOverviewSubtitle ?? "";
  const quickActions = useMemo(
    () => (settings?.meta.quickActions ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [settings?.meta.quickActions],
  );

  /* KPI 1: Services online */
  const enabledServices = services.filter((s) => s.enabled && s.pingTarget.kind !== "none");
  const onlineServices = enabledServices.filter((s) => status[s.id]?.status === "online").length;
  const totalServices = enabledServices.length;
  const servicesValue = totalServices === 0 ? "—" : `${onlineServices}/${totalServices}`;
  const servicesTone =
    totalServices === 0
      ? "muted"
      : onlineServices === totalServices
      ? "ok"
      : onlineServices === 0
      ? "err"
      : "warn";

  /* KPI 2: DNS Blockrate */
  const adguardData = adguard.data;
  let blockrateValue = "—";
  let blockrateMeta = "DNS-Filter nicht konfiguriert";
  let blockrateTone: KpiTileProps["tone"] = "muted";
  if (adguardData?.configured) {
    if (adguardData.online && adguardData.stats) {
      blockrateValue = `${adguardData.stats.blockedPercent.toFixed(1)}%`;
      blockrateMeta = "AdGuard · /control/stats";
      blockrateTone = "default";
    } else {
      blockrateMeta = adguardData.error ?? "Offline";
      blockrateTone = "err";
    }
  }

  /* KPI 3: HA Health */
  const haData = smartHome.data;
  let haValue = "—";
  let haMeta = "Home Assistant nicht konfiguriert";
  let haTone: KpiTileProps["tone"] = "muted";
  if (haData?.configured) {
    if (haData.online && haData.health) {
      const status = haData.health.status;
      if (status === "healthy") {
        haValue = "OK";
        haMeta = "0 Probleme · Updates ok";
        haTone = "ok";
      } else if (status === "warn") {
        haValue = String(haData.health.problems ?? 0);
        haMeta = "Probleme · Updates verfügbar";
        haTone = "warn";
      } else {
        haValue = String(haData.health.problems ?? 0);
        haMeta = "Akute Probleme erkannt";
        haTone = "err";
      }
    } else {
      haMeta = haData.error ?? "Offline";
      haTone = "err";
    }
  }

  /* KPI 4: Auth Mode */
  const authMode = settings?.auth.mode ?? "open";
  const authInfo = authModeLabel(authMode);
  const authTone: KpiTileProps["tone"] = authMode === "open" ? "warn" : "ok";

  return (
    <section className="command-overview" aria-label="Command Overview">
      <div className="cmd-row-top">
        <div className="cmd-row-top-text">
          <span className="cmd-eyebrow">COMMAND OVERVIEW</span>
          <h2 className="cmd-title">
            <span className="cmd-title-time">Heute, {formatTime(now)}</span>
            {domain ? (
              <>
                <span className="cmd-title-sep" aria-hidden>·</span>
                <span className="cmd-title-domain">{domain}</span>
              </>
            ) : null}
          </h2>
          {subtitle ? <p className="cmd-subtitle">{subtitle}</p> : null}
        </div>
        {quickActions.length > 0 ? (
          <div className="cmd-quick-actions">
            {quickActions.map((qa) => (
              <a
                key={qa.id}
                href={qa.url}
                target={qa.target}
                rel={qa.target === "_blank" ? "noopener noreferrer" : undefined}
                className="cmd-quick-btn"
              >
                {qa.iconEmoji ? <span className="cmd-quick-icon">{qa.iconEmoji}</span> : null}
                <span>{qa.label}</span>
                {qa.target === "_blank" ? <ExternalLink size={11} aria-hidden /> : null}
              </a>
            ))}
          </div>
        ) : null}
      </div>

      <div className="cmd-kpi-grid">
        <KpiTile
          label="Services online"
          value={servicesValue}
          meta="healthcheck · 10s"
          tone={servicesTone}
          tooltip="Anteil der Services aus deiner Service-Liste, deren Health-Check (HTTP/TCP) gerade ein Online-Resultat liefert. Quelle: tRPC status.all (10s-Polling)."
        />
        <KpiTile
          label="DNS Blockrate"
          value={blockrateValue}
          meta={blockrateMeta}
          tone={blockrateTone}
          tooltip={
            adguardData?.configured
              ? "Prozent der DNS-Anfragen, die AdGuard Home blockiert hat. Quelle: /control/stats. Sichtbar wenn AdGuard unter Admin → Integrationen konfiguriert ist."
              : "Wird angezeigt, sobald du AdGuard Home unter Admin → Integrationen → AdGuard verbindest. Pi-hole-Support folgt analog."
          }
        />
        <KpiTile
          label="HA Health"
          value={haValue}
          meta={haMeta}
          tone={haTone}
          tooltip={
            haData?.configured
              ? "Status deiner Home-Assistant-Instanz: OK = keine Probleme; Zahl = Anzahl Problem-Entities. Quelle: /api/widgets/smart-home (HA REST)."
              : "Wird angezeigt, sobald du Home Assistant unter Admin → Integrationen → Home Assistant mit URL + Long-Lived-Token verbindest."
          }
        />
        <KpiTile
          label="Auth Mode"
          value={authInfo.value}
          meta={authInfo.meta}
          tone={authTone}
          tooltip="Aktiver Login-Modus. 'Offen' = jeder Besucher hat Admin-Zugriff (nur für Setup geeignet). Konfigurierbar unter Admin → Auth."
        />
      </div>
    </section>
  );
}
