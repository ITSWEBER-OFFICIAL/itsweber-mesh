"use client";

import { useQuery } from "@tanstack/react-query";
import { Camera, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import type { CameraListData } from "@/app/api/widgets/cameras/route";

function CameraSnapshot({ id, label, refreshSec, linkUrl }: {
  id: string;
  label: string;
  refreshSec: number;
  linkUrl?: string;
}) {
  const [ts, setTs] = useState(() => Date.now());
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
    const interval = setInterval(() => {
      setTs(Date.now());
      setError(false);
    }, refreshSec * 1000);
    return () => clearInterval(interval);
  }, [refreshSec]);

  const src = `/api/widgets/cameras/snapshot?id=${id}&t=${ts}`;

  const inner = (
    <div className="cam-snapshot-wrap">
      {error ? (
        <div className="cam-error">⚠ Snapshot nicht verfügbar</div>
      ) : (
        <img
          src={src}
          alt={label}
          className="cam-img"
          onError={() => setError(true)}
          onLoad={() => setError(false)}
        />
      )}
      <div className="cam-label-bar">
        <span className="cam-label">{label}</span>
        {linkUrl && <ExternalLink size={9} className="cam-ext-icon" />}
      </div>
    </div>
  );

  if (linkUrl) {
    return (
      <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="cam-link">
        {inner}
      </a>
    );
  }
  return inner;
}

export function CameraWidget({ label, refreshSec, linkUrl }: {
  label: string;
  refreshSec: number;
  linkUrl?: string;
}) {
  const { data, isLoading } = useQuery<CameraListData>({
    queryKey: ["widget-cameras"],
    queryFn: () => fetch("/api/widgets/cameras").then((r) => r.json()),
    staleTime: 60_000,
  });

  const cameras = data?.cameras ?? [];

  return (
    <div className="widget-card cam-widget">
      <span className="widget-accent cam-accent" />
      <div className="widget-header">
        <Camera size={14} className="cam-icon" />
        <span className="widget-title">{label}</span>
        {cameras.length > 0 && (
          <span className="widget-badge">{cameras.length} {cameras.length === 1 ? "Kamera" : "Kameras"}</span>
        )}
      </div>

      {isLoading && <div className="widget-loading">Lade…</div>}

      {!isLoading && cameras.length === 0 && (
        <div className="widget-hint">
          Keine Kameras konfiguriert — <strong>Admin → Kameras</strong>
        </div>
      )}

      {cameras.length > 0 && (
        <div className="cam-grid">
          {cameras.map((cam) => {
            const camLink = linkUrl ?? cam.linkUrl;
            return (
              <CameraSnapshot
                key={cam.id}
                id={cam.id}
                label={cam.label}
                refreshSec={cam.refreshSec}
                {...(camLink ? { linkUrl: camLink } : {})}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
