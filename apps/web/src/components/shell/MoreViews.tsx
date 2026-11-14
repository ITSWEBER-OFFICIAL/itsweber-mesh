"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";
import type { UnraidWidgetData } from "@/app/api/widgets/unraid/route";
import type { NetworkWidgetData } from "@/app/api/widgets/network/route";
import { Screen, Dot, Icon } from "./AppShell";
import { DownList } from "./DownList";
import { useMeshData } from "./useMeshData";
import { useHints, HintList } from "./Hints";

const getJson = <T,>(url: string, empty: T) => (): Promise<T> =>
  fetch(url).then((r) => (r.ok ? (r.json() as Promise<T>) : empty));

/* ── Server ──────────────────────────────────────────────────────────────── */
export function ServerView() {
  const { data: nodes = [] } = trpc.infraNodes.list.useQuery();
  const { data: unraid } = useQuery({
    queryKey: ["widget-unraid"],
    queryFn: getJson<UnraidWidgetData>("/api/widgets/unraid", { instances: [] }),
    refetchInterval: 30_000,
  });
  const { data: network } = useQuery({
    queryKey: ["widget-network"],
    queryFn: getJson<NetworkWidgetData>("/api/widgets/network", { entries: [] }),
    refetchInterval: 30_000,
  });

  const enabled = nodes.filter((n) => n.enabled);
  const devices = network?.entries ?? [];

  return (
    <Screen title="Server" small context={`${enabled.length + devices.length} Geräte`}>
      <section className="m-sec">
        <h2 className="m-h">Server · {enabled.length}</h2>
        {enabled.length === 0 && <p className="m-note">Noch keine Server angelegt.</p>}
        <div className="m-sheets">
          {enabled.map((node) => {
            const inst = unraid?.instances.find((i) => i.id === node.integrationRef?.id);
            const data = inst?.online ? inst.data : undefined;
            const state = !node.integrationRef ? "unknown" : data ? "ok" : inst ? "bad" : "unknown";
            const cap = data?.array?.capacity;
            return (
              <article className="m-sheet" key={node.id}>
                <h3>
                  <Dot state={state} />
                  {node.label}
                  <small>{data?.unraidVersion ? `Unraid ${data.unraidVersion}` : node.versionOverride ?? node.ip ?? ""}</small>
                </h3>
                {data ? (
                  <div className="m-kv">
                    <div>
                      <b>{cap ? `${Math.round(cap.percent)} %` : "–"}</b>
                      <span>Array</span>
                    </div>
                    <div>
                      <b>{data.containers ? `${data.containers.running}/${data.containers.total}` : "–"}</b>
                      <span>Container</span>
                    </div>
                    <div>
                      <b>{data.vms ? `${data.vms.running}/${data.vms.total}` : "–"}</b>
                      <span>VMs</span>
                    </div>
                  </div>
                ) : (
                  <p className="m-note">
                    {state === "bad" ? "Die Schnittstelle antwortet nicht." : "Keine Live-Werte, es ist keine Schnittstelle verknüpft."}
                  </p>
                )}
                {(node.linkUrl || node.integrationRef) && (
                  <div className="m-act">
                    {node.integrationRef && (
                      <Link className="m-btn p" href={`/server/${node.id}`}>
                        Platten, Container, VMs
                      </Link>
                    )}
                    {node.linkUrl && (
                      <a className={node.integrationRef ? "m-btn" : "m-btn p"} href={node.linkUrl} target="_blank" rel="noopener noreferrer">
                        Oberfläche
                      </a>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {devices.length > 0 && (
        <section className="m-sec">
          <h2 className="m-h">Netzwerk · {devices.length}</h2>
          {devices.map((d) => {
            const state = d.status === "online" ? "ok" : d.status === "offline" ? "bad" : "unknown";
            const inner = (
              <>
                <Dot state={state} />
                <span>
                  <b>{d.label}</b>
                  {d.sub && <small>{d.sub}</small>}
                </span>
              </>
            );
            return (
              <div className="m-row" key={d.id}>
                {d.url ? (
                  <a className="m-row-link" href={d.url} target="_blank" rel="noopener noreferrer">
                    {inner}
                  </a>
                ) : (
                  <div className="m-row-link">{inner}</div>
                )}
                {typeof d.latencyMs === "number" && <span className="m-tag">{d.latencyMs} ms</span>}
              </div>
            );
          })}
        </section>
      )}
    </Screen>
  );
}

/* ── Hinweise ────────────────────────────────────────────────────────────── */
export function HinweiseView() {
  const { down, pings, loading } = useMeshData();
  const hints = useHints();
  const urgent = down.length + hints.urgent.length;
  return (
    <Screen title="Hinweise" small context={loading ? undefined : `${urgent} dringend · ${hints.watch.length} im Blick`}>
      <section className="m-sec">
        <h2 className="m-h">Dringend · {urgent}</h2>
        {urgent === 0 ? (
          <div className="m-msg">
            <Dot state="ok" />
            <div>
              <b>Nichts Dringendes</b>
              <small>Dienste, Server und Zertifikate sind in Ordnung</small>
            </div>
          </div>
        ) : (
          <>
            <HintList hints={hints.urgent} />
            <DownList services={down} pings={pings} />
          </>
        )}
      </section>
      <section className="m-sec">
        <h2 className="m-h">Im Blick · {hints.watch.length}</h2>
        {hints.loading ? (
          <p className="m-note">Wird geprüft.</p>
        ) : hints.failed ? (
          <p className="m-note">Die Hinweise konnten nicht geladen werden.</p>
        ) : hints.watch.length === 0 ? (
          <p className="m-note">Keine Updates, keine gestoppten Container, kein Zertifikat läuft bald ab.</p>
        ) : (
          <HintList hints={hints.watch} />
        )}
        {hints.notes.map((n) => (
          <p className="m-note" key={n}>{n}</p>
        ))}
        <p className="m-note">Platten und Unraid-Warnungen folgen.</p>
      </section>
    </Screen>
  );
}

/* ── Mehr ────────────────────────────────────────────────────────────────── */
const THEMES = [
  { value: "system", label: "Gerät" },
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
] as const;

function MoreLink({ href, title, sub, external }: { href: string; title: string; sub: string; external?: boolean }) {
  const inner = (
    <>
      <span>
        <b>{title}</b>
        <small style={{ fontFamily: "var(--m-f)", fontSize: 12.5 }}>{sub}</small>
      </span>
    </>
  );
  return (
    <div className="m-row">
      {external ? (
        <a className="m-row-link" href={href}>{inner}</a>
      ) : (
        <Link className="m-row-link" href={href}>{inner}</Link>
      )}
      <span className="m-chev"><Icon name="pfeil" /></span>
    </div>
  );
}

export function MehrView() {
  const { overview } = useMeshData();
  const { data: settings } = trpc.settings.get.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const updateTheme = trpc.settings.updateTheme.useMutation({
    onSuccess: () => { utils.settings.get.invalidate(); toast.success("Thema übernommen"); },
    onError: (e) => toast.error("Thema nicht gespeichert", e.message),
  });
  const count = (c: "web" | "gaming") => overview.segments.find((s) => s.category === c)?.total ?? 0;
  const oauth = settings?.auth.mode === "oauth2";

  async function logout() {
    if (oauth) {
      window.location.href = "/api/auth/oidc/logout";
      return;
    }
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/";
    } catch {
      toast.error("Abmelden fehlgeschlagen");
    }
  }

  return (
    <Screen title="Mehr" small context={settings?.meta.name}>
      <section className="m-sec">
        <h2 className="m-h">Web und Gaming</h2>
        <MoreLink href="/mehr/web" title="Webseiten" sub={`${count("web")} Seiten mit Antwortzeit und Zertifikat`} />
        <MoreLink href="/mehr/gaming" title="Gameserver" sub="Server, Spieler und Dienste rund ums Spielen" />
      </section>

      <section className="m-sec" style={{ gap: 8 }}>
        <h2 className="m-h">Thema</h2>
        <div className="m-switch" role="group" aria-label="Thema">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={settings?.theme.preset === t.value}
              disabled={updateTheme.isPending}
              onClick={() => updateTheme.mutate({ preset: t.value })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="m-sec">
        <h2 className="m-h">Verwaltung</h2>
        <MoreLink href="/admin" title="Verwaltung von Mesh" sub="Dienste, Schnittstellen, Anmeldung, Sicherung" />
        <MoreLink href="/boards/home" title="Widget-Board" sub="Die bisherige Übersicht mit allen Widgets" />
        <MoreLink href="/mehr/protokoll" title="Protokoll" sub="Wer hat wann was gestartet oder gestoppt" />
      </section>

      <section className="m-sec" style={{ gap: 10 }}>
        {settings && settings.auth.mode !== "open" && (
          <button type="button" className="m-btn" style={{ alignSelf: "flex-start" }} onClick={logout}>
            Abmelden
          </button>
        )}
        <p className="m-foot">MESH {process.env["NEXT_PUBLIC_VERSION"]}</p>
      </section>
    </Screen>
  );
}
