"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";
import { hostOf, pickUrl } from "@/lib/service-view";
import type { Service } from "@/server/config/schema";
import type { GameserverStatus } from "@/app/api/gameserver/route";
import { Screen, Dot } from "./AppShell";
import { useMeshData } from "./useMeshData";
import { useHints } from "./useHints";

const DAY_MS = 86_400_000;

function BackChip() {
  return (
    <div className="m-chips">
      <Link href="/mehr" className="m-chip"><span>Zurück zu Mehr</span></Link>
    </div>
  );
}

function ServiceRows({ list }: { list: Service[] }) {
  const { pings, internal, health } = useMeshData();
  const { certs } = useHints();
  const [now] = useState(() => Date.now());
  return (
    <>
      {list.map((s) => {
        const url = pickUrl(s, internal);
        const ping = pings[s.id];
        const host = hostOf(s.urlExternal ?? s.url);
        const cert = certs.find((c) => c.host === host);
        const days = cert ? Math.floor((cert.validTo - now) / DAY_MS) : null;
        const parts = [host, days !== null ? `Zertifikat ${days} Tage` : null].filter(Boolean);
        return (
          <div className="m-row" key={s.id}>
            <a className="m-row-link" href={url.href} target="_blank" rel="noopener noreferrer">
              <Dot state={health(s)} />
              <span>
                <b>{s.name}</b>
                <small>{parts.join(" · ")}</small>
              </span>
            </a>
            <span className="m-tag">
              {ping?.status === "online" && typeof ping.latencyMs === "number" ? `${ping.latencyMs} ms` : ping ? "keine Antwort" : "–"}
            </span>
          </div>
        );
      })}
    </>
  );
}

/* ── Webseiten ───────────────────────────────────────────────────────────── */
export function WebView() {
  const { services, health, loading } = useMeshData();
  const list = services.filter((s) => s.category === "web");
  const up = list.filter((s) => health(s) === "ok").length;
  return (
    <Screen title="Webseiten" small context={loading ? undefined : `${up} von ${list.length} antworten`} kanzel={<BackChip />}>
      <section className="m-sec">
        <h2 className="m-h">Seiten · {list.length}</h2>
        {list.length === 0 ? (
          <p className="m-note">Noch keine Dienste im Bereich Web. Unter Verwaltung, Dienste lässt sich die Liste einlesen oder ein Dienst dem Bereich Web zuordnen.</p>
        ) : (
          <ServiceRows list={list} />
        )}
        <p className="m-note">Antwortzeit gemessen von Mesh aus, Zertifikat alle sechs Stunden geprüft.</p>
      </section>
    </Screen>
  );
}

/* ── Gameserver ──────────────────────────────────────────────────────────── */
export function GamingView() {
  const { services } = useMeshData();
  const list = services.filter((s) => s.category === "gaming");
  const { data: me } = trpc.status.me.useQuery(undefined, { staleTime: 300_000 });
  const utils = trpc.useUtils();
  const qc = useQueryClient();
  const toast = useToast();
  const isAdmin = me?.role === "admin";
  const { data: gsCfg } = trpc.integrations.getGameserver.useQuery(undefined, { enabled: isAdmin });
  const stored = gsCfg?.statusUrl ?? "";
  const [url, setUrl] = useState("");
  const [edit, setEdit] = useState(false);
  useEffect(() => setUrl(stored), [stored]);

  const { data: gs } = useQuery<GameserverStatus>({
    queryKey: ["gameserver"],
    queryFn: () => fetch("/api/gameserver", { cache: "no-store" }).then((r) => r.json()),
    refetchInterval: 30_000,
  });
  const save = trpc.integrations.updateGameserver.useMutation({
    onSuccess: () => {
      void utils.integrations.getGameserver.invalidate();
      void qc.invalidateQueries({ queryKey: ["gameserver"] });
      setEdit(false);
      toast.success("Adresse gespeichert");
    },
    onError: (e) => toast.error("Adresse nicht gespeichert", e.message),
  });
  const online = gs?.servers.filter((s) => s.online).length ?? 0;

  return (
    <Screen
      title="Gameserver"
      small
      context={gs?.online ? `${gs.playersOnline} Spieler online` : undefined}
      kanzel={<BackChip />}
    >
      <section className="m-sec">
        <h2 className="m-h">Server{gs?.online ? ` · ${online} von ${gs.servers.length} laufen` : ""}</h2>
        {!gs ? (
          <p className="m-note">Wird geladen.</p>
        ) : !gs.configured ? (
          <p className="m-note">Die Status-Schnittstelle der Gameserver ist noch nicht hinterlegt.</p>
        ) : !gs.online ? (
          <div className="m-msg">
            <Dot state="bad" />
            <div>
              <b>Die Status-Schnittstelle antwortet nicht</b>
              <small>{gs.error ?? "Keine Antwort"}</small>
            </div>
          </div>
        ) : (
          <>
            {gs.maintenance && (
              <div className="m-msg">
                <Dot state="warn" />
                <div>
                  <b>Wartung</b>
                  <small>{gs.maintenance}</small>
                </div>
              </div>
            )}
            {gs.stale && <p className="m-note">Die Schnittstelle meldet veraltete Werte.</p>}
            {gs.servers.length === 0 && <p className="m-note">Die Schnittstelle meldet keine Server.</p>}
            {gs.servers.map((s) => (
              <div className="m-row" key={s.id}>
                <div className="m-row-link">
                  <Dot state={s.online ? "ok" : "unknown"} />
                  <span>
                    <b>{s.name}</b>
                    <small>{[s.online ? "läuft" : s.state, s.version].filter(Boolean).join(" · ")}</small>
                  </span>
                </div>
                <span className="m-tag">{s.players ? `${s.players.online}${s.players.max ? `/${s.players.max}` : ""}` : "–"}</span>
              </div>
            ))}
          </>
        )}
        {isAdmin && !edit && (
          <button type="button" className="m-btn" style={{ alignSelf: "flex-start", marginTop: 8 }} onClick={() => setEdit(true)}>
            {stored ? "Adresse ändern" : "Adresse hinterlegen"}
          </button>
        )}
        {isAdmin && edit && (
          <form
            className="m-form"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({ statusUrl: url.trim() });
            }}
          >
            <label htmlFor="gs-url">Adresse der Status-Schnittstelle</label>
            <input
              id="gs-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://api.example.net"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <small>Mesh ruft davon /v1/status ab. Leer lassen, um die Abfrage abzuschalten.</small>
            <div className="m-act">
              <button type="submit" className="m-btn p" disabled={save.isPending}>{save.isPending ? "Speichert" : "Speichern"}</button>
              <button type="button" className="m-btn" disabled={save.isPending} onClick={() => { setEdit(false); setUrl(stored); }}>Abbrechen</button>
            </div>
          </form>
        )}
      </section>

      {list.length > 0 && (
        <section className="m-sec">
          <h2 className="m-h">Dienste rund ums Spielen · {list.length}</h2>
          <ServiceRows list={list} />
        </section>
      )}
    </Screen>
  );
}

/* ── Protokoll ───────────────────────────────────────────────────────────── */
const ACTION_LABEL: Record<string, string> = {
  "container.start": "Container gestartet",
  "container.stop": "Container gestoppt",
  "container.restart": "Container neu gestartet",
  "vm.start": "VM gestartet",
  "vm.stop": "VM gestoppt",
  "push.test": "Testmeldung gesendet",
};
const RESULT_NOTE = { ok: "", failed: "fehlgeschlagen", refused: "abgelehnt" } as const;

export function ProtokollView() {
  const { data: me } = trpc.status.me.useQuery(undefined, { staleTime: 300_000 });
  const isAdmin = me?.role === "admin";
  const { data: log, isLoading } = trpc.actions.log.useQuery(undefined, { enabled: isAdmin, refetchInterval: 30_000 });
  return (
    <Screen title="Protokoll" small context={log ? `${log.length} Einträge` : undefined} kanzel={<BackChip />}>
      <section className="m-sec">
        <h2 className="m-h">Aktionen</h2>
        {me && !isAdmin ? (
          <p className="m-note">Das Protokoll ist Admins vorbehalten.</p>
        ) : isLoading || !me ? (
          <p className="m-note">Wird geladen.</p>
        ) : !log || log.length === 0 ? (
          <p className="m-note">Noch keine Aktion ausgeführt. Jeder Start, Stopp und Neustart aus Mesh erscheint hier mit Zeit und Person.</p>
        ) : (
          log.map((e, i) => (
            <div className="m-msg" key={`${e.at}-${i}`}>
              <Dot state={e.result === "ok" ? "ok" : e.result === "refused" ? "warn" : "bad"} />
              <div>
                <b>
                  {e.target} · {ACTION_LABEL[e.action] ?? e.action}
                  {RESULT_NOTE[e.result] ? `, ${RESULT_NOTE[e.result]}` : ""}
                </b>
                <small>
                  {[
                    new Date(e.at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
                    e.system,
                    e.user,
                    e.detail,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </div>
            </div>
          ))
        )}
      </section>
    </Screen>
  );
}
