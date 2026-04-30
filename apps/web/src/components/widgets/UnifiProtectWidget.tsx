"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Camera, CameraOff, X, RefreshCw, Video, VideoOff,
  Activity, Bell, Moon, Eye, Circle,
} from "lucide-react";
import type { ProtectCamera, ProtectSummary, UnifiProtectWidgetData } from "@/app/api/widgets/unifiProtect/route";
import type { WidgetRenderProps } from "./registry";

/* ── helpers ──────────────────────────────────────────────────────────────── */

function relativeTime(ms: number | null): string | null {
  if (ms === null) return null;
  const diff = Date.now() - ms;
  if (diff < 60_000) return "gerade eben";
  if (diff < 3_600_000) return `vor ${Math.floor(diff / 60_000)} Min.`;
  if (diff < 86_400_000) return `vor ${Math.floor(diff / 3_600_000)} Std.`;
  return `vor ${Math.floor(diff / 86_400_000)} T.`;
}

function fmtUptime(sec: number | null): string | null {
  if (sec === null) return null;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`;
}

function RecModeTag({ mode }: { mode: string }) {
  if (mode === "always")
    return <span className="protect-badge protect-badge--rec">● REC</span>;
  if (mode === "motion")
    return <span className="protect-badge protect-badge--motion">◆ Motion</span>;
  if (mode === "never" || mode === "disabled")
    return <span className="protect-badge protect-badge--dim">Deakt.</span>;
  // "unknown" oder sonstige API-Werte: nichts anzeigen
  return null;
}

function SmartTypes({ types }: { types: string[] }) {
  if (!types.length) return null;
  return (
    <span className="protect-smart-types">
      {types.map((t) => (
        <span key={t} className="protect-smart-tag">{t}</span>
      ))}
    </span>
  );
}

/* ── Summary bar ─────────────────────────────────────────────────────────── */

function SummaryBar({ s, small }: { s: ProtectSummary; small?: boolean }) {
  const sz = small ? 11 : 13;
  return (
    <div className={`protect-summary${small ? " protect-summary--small" : ""}`}>
      <span className="protect-summary-item" title="Kamera Online">
        <Camera size={sz} className="text-[var(--status-ok)]" />
        <span>{s.online}<span className="protect-summary-total">/{s.total}</span></span>
      </span>
      <span className="protect-summary-item" title="Aufnahme aktiv">
        <Video size={sz} className={s.recording > 0 ? "text-[#f87171]" : "text-[var(--dim)]"} />
        <span>{s.recording}</span>
      </span>
      <span className="protect-summary-item" title="Bewegung erkannt">
        <Activity size={sz} className={s.motionActive > 0 ? "text-[var(--status-warn)]" : "text-[var(--dim)]"} />
        <span>{s.motionActive}</span>
      </span>
      {s.doorbells > 0 && (
        <span className="protect-summary-item" title="Türklingeln">
          <Bell size={sz} className="text-[#a78bfa]" />
          <span>{s.doorbells}</span>
        </span>
      )}
    </div>
  );
}

/* ── Lightbox ─────────────────────────────────────────────────────────────── */

function ProtectLightbox({ cam, onClose }: { cam: ProtectCamera; onClose: () => void }) {
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setTick((t) => t + 1), 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="protect-lightbox" aria-label={cam.name}>
          <div className="protect-lightbox-header">
            <span className="protect-lightbox-title">
              <Camera size={14} />
              {cam.name}
              {cam.isDoorbell && <span title="Doorbell"><Bell size={12} className="text-[#a78bfa]" /></span>}
              {cam.isDark && <span title="Nacht-Modus"><Moon size={12} className="text-[var(--dim)]" /></span>}
            </span>
            <div className="flex items-center gap-[8px]">
              <span className="protect-lightbox-refresh"><RefreshCw size={11} />Auto-Refresh 5s</span>
              <Dialog.Close asChild>
                <button className="modal-close-btn" aria-label="Schließen"><X size={16} /></button>
              </Dialog.Close>
            </div>
          </div>

          <div className="protect-lightbox-body">
            {loading && (
              <div className="protect-lightbox-loading">
                <RefreshCw size={20} className="animate-spin text-[var(--brand)]" />
              </div>
            )}
            <img
              key={`${cam.id}-${tick}`}
              src={`${cam.snapshotUrl}?t=${tick}`}
              alt={cam.name}
              className={`protect-lightbox-img${loading ? " protect-lightbox-img--hidden" : ""}`}
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
            />
          </div>

          <div className="protect-lightbox-footer">
            <div className="flex items-center gap-[10px]">
              <span className={`protect-status-dot ${cam.state === "CONNECTED" ? "protect-status-dot--ok" : "protect-status-dot--err"}`} />
              <span className="text-[11px] font-mono">
                {cam.state === "CONNECTED" ? "Online" : "Offline"}
              </span>
              <RecModeTag mode={cam.recordingMode} />
              {cam.uptime !== null && (
                <span className="text-[10px] text-[var(--dim)]" title="Uptime">↑ {fmtUptime(cam.uptime)}</span>
              )}
            </div>
            <div className="flex items-center gap-[8px]">
              {cam.lastMotion !== null && (
                <span className="text-[10px] text-[var(--dim)]">
                  <Activity size={9} className="inline mr-[2px]" />{relativeTime(cam.lastMotion)}
                </span>
              )}
              {cam.lastRing !== null && (
                <span className="text-[10px] text-[#a78bfa]">
                  <Bell size={9} className="inline mr-[2px]" />{relativeTime(cam.lastRing)}
                </span>
              )}
              <button
                type="button"
                className="btn-ghost text-[11px] px-[8px] py-[4px]"
                onClick={() => { setLoading(true); setTick((t) => t + 1); }}
              >
                <RefreshCw size={11} />Aktualisieren
              </button>
            </div>
          </div>

          {/* Kamera-Details unter dem Bild */}
          <div className="protect-lightbox-details">
            <div className="protect-detail-row">
              <span className="protect-detail-label">Modell</span>
              <span className="protect-detail-value">{cam.type}</span>
            </div>
            {cam.smartDetectTypes.length > 0 && (
              <div className="protect-detail-row">
                <span className="protect-detail-label">Smart Detect</span>
                <SmartTypes types={cam.smartDetectTypes} />
              </div>
            )}
            {cam.isMotionDetected && (
              <div className="protect-detail-row">
                <span className="protect-detail-label">Status</span>
                <span className="text-[11px] text-[var(--status-warn)] font-semibold">Bewegung aktiv</span>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ── Sidebar camera row ──────────────────────────────────────────────────── */

function CamRow({ cam, refreshSec, onClick }: { cam: ProtectCamera; refreshSec: number; onClick: () => void }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), refreshSec * 1000);
    return () => clearInterval(id);
  }, [refreshSec]);

  const isOnline = cam.state === "CONNECTED";

  return (
    <button type="button" className="protect-cam-row" onClick={onClick} title={`${cam.name} — Klick für Großansicht`}>
      {/* Thumbnail */}
      <div className={`protect-snap-wrap ${!isOnline ? "opacity-50" : ""}`}>
        <img
          key={`${cam.id}-${tick}`}
          src={`${cam.snapshotUrl}?t=${tick}`}
          alt={cam.name}
          className="protect-snap"
          loading="lazy"
        />
        {!isOnline && (
          <div className="protect-cam-offline-overlay">
            <CameraOff size={12} />
          </div>
        )}
        {cam.isMotionDetected && isOnline && (
          <div className="protect-motion-pill">
            <Activity size={8} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="protect-row-info">
        <div className="protect-row-name-line">
          <span className={`protect-status-dot ${isOnline ? "protect-status-dot--ok" : "protect-status-dot--err"}`} />
          <span className="protect-row-name">{cam.name}</span>
          {cam.isDoorbell && <Bell size={10} className="text-[#a78bfa] flex-shrink-0" />}
          {cam.isDark && <Moon size={10} className="text-[var(--dim)] flex-shrink-0" />}
        </div>
        <div className="protect-row-meta">
          <RecModeTag mode={cam.recordingMode} />
          {cam.lastMotion !== null && (
            <span className="protect-row-time">
              <Activity size={8} />{relativeTime(cam.lastMotion)}
            </span>
          )}
          {cam.lastRing !== null && (
            <span className="protect-row-time text-[#a78bfa]">
              <Bell size={8} />{relativeTime(cam.lastRing)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ── Compact/Grid camera tile ────────────────────────────────────────────── */

function CamTile({ cam, refreshSec, onClick }: { cam: ProtectCamera; refreshSec: number; onClick: () => void }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), refreshSec * 1000);
    return () => clearInterval(id);
  }, [refreshSec]);

  const isOnline = cam.state === "CONNECTED";

  return (
    <button
      type="button"
      className={`protect-cam-tile ${!isOnline ? "protect-cam-tile--offline" : ""}`}
      onClick={onClick}
      title={`${cam.name} — Klick für Großansicht`}
    >
      <div className="protect-cam-thumb">
        <img
          key={`${cam.id}-${tick}`}
          src={`${cam.snapshotUrl}?t=${tick}`}
          alt={cam.name}
          className="protect-cam-img"
          loading="lazy"
        />
        {!isOnline && (
          <div className="protect-cam-offline-overlay"><CameraOff size={16} /></div>
        )}
        {cam.isMotionDetected && isOnline && (
          <div className="protect-motion-pill"><Activity size={9} />Motion</div>
        )}
        {cam.isRecording && isOnline && (
          <div className="protect-rec-pill"><Circle size={7} className="fill-current" />REC</div>
        )}
      </div>

      <div className="protect-tile-footer">
        <div className="protect-tile-name-row">
          <span className={`protect-status-dot ${isOnline ? "protect-status-dot--ok" : "protect-status-dot--err"}`} />
          <span className="protect-tile-name">{cam.name}</span>
          {cam.isDoorbell && <Bell size={9} className="text-[#a78bfa]" />}
          {cam.isDark && <Moon size={9} className="text-[var(--dim)]" />}
        </div>
        <div className="protect-tile-meta">
          <RecModeTag mode={cam.recordingMode} />
          {cam.lastMotion !== null && (
            <span className="protect-row-time"><Activity size={8} />{relativeTime(cam.lastMotion)}</span>
          )}
        </div>
        {cam.smartDetectTypes.length > 0 && (
          <SmartTypes types={cam.smartDetectTypes} />
        )}
      </div>
    </button>
  );
}

/* ── Main widget ─────────────────────────────────────────────────────────── */

export function UnifiProtectWidget({ instance, compact }: WidgetRenderProps) {
  const { label, refreshSec } = instance;
  const useGrid = instance.gridLayout.w >= 8;
  const [lightbox, setLightbox] = useState<ProtectCamera | null>(null);

  const { data, isLoading } = useQuery<UnifiProtectWidgetData>({
    queryKey: ["widget-unifi-protect"],
    queryFn: () => fetch("/api/widgets/unifiProtect").then((r) => r.json()),
    refetchInterval: refreshSec * 1000,
    staleTime: (refreshSec - 2) * 1000,
  });

  return (
    <>
      <div className="widget-card">
        <span className="widget-accent protect-accent" />
        <div className="widget-header">
          <Video size={14} className="text-[#60a5fa]" />
          <span className="widget-title">{label}</span>
          {data?.online && data.summary ? (
            <span className="widget-status-ok ml-auto flex items-center gap-[4px]">
              <Camera size={10} />
              {data.summary.online}/{data.summary.total}
            </span>
          ) : data?.configured ? (
            <span className="widget-status-err ml-auto flex items-center gap-[4px]">
              <VideoOff size={10} />Offline
            </span>
          ) : null}
        </div>

        {isLoading && <div className="widget-loading">Verbinde…</div>}

        {data && !data.configured && (
          <div className="widget-hint">Nicht konfiguriert — <strong>Admin → Integrationen</strong></div>
        )}

        {data?.configured && !data.online && (
          <div className="widget-error">{data.error ?? "Keine Verbindung"}</div>
        )}

        {data?.online && data.cameras && data.summary && (
          <>
            <SummaryBar s={data.summary} small={useGrid} />

            {/* Sidebar layout: kompakte Liste mit Thumbnail-Zeilen */}
            {!useGrid && (
              <div className="protect-cam-list">
                {data.cameras.map((cam) => (
                  <CamRow
                    key={cam.id}
                    cam={cam}
                    refreshSec={refreshSec}
                    onClick={() => setLightbox(cam)}
                  />
                ))}
              </div>
            )}

            {/* Grid layout: horizontal für alle nicht-Sidebar Slots */}
            {useGrid && (
              <div className="protect-cam-grid protect-cam-grid--full">
                {data.cameras.map((cam) => (
                  <CamTile
                    key={cam.id}
                    cam={cam}
                    refreshSec={refreshSec}
                    onClick={() => setLightbox(cam)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {lightbox && (
        <ProtectLightbox cam={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}
