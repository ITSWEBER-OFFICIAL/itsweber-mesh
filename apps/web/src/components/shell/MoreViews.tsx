"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";
import { Screen, Dot, Icon } from "./AppShell";
import { DownList } from "./DownList";
import { useMeshData } from "./useMeshData";
import { useHints, HintList } from "./Hints";
import { PushToggle } from "./PushToggle";

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
          <HintList hints={hints.watch} actions />
        )}
        {hints.notes.map((n) => (
          <p className="m-note" key={n}>{n}</p>
        ))}
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

      <PushToggle />

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
