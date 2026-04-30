"use client";

import { useState } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { ExternalLink } from "lucide-react";
import type { Service } from "@/server/config/schema";
import type { PingResult } from "@/server/healthcheck/pinger";
import { StatusDot } from "./StatusDot";

type Props = {
  service: Service;
  pingResult?: PingResult | null;
  index?: number;
  editMode?: boolean;
  showCategory?: boolean;
};

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const ICON_CLASS: Record<Service["category"], string> = {
  "infrastructure": "icon-infrastructure",
  "smart-home":     "icon-smart-home",
  "media":          "icon-media",
  "tools":          "icon-tools",
  "external":       "icon-external",
};

const EMOJI: Record<Service["category"], string> = {
  "infrastructure": "⚙️",
  "smart-home":     "🏠",
  "media":          "🎬",
  "tools":          "🔧",
  "external":       "🌐",
};

const CATEGORY_LABEL: Record<Service["category"], string> = {
  "infrastructure": "Infra",
  "smart-home":     "Smart Home",
  "media":          "Media",
  "tools":          "Tools",
  "external":       "Extern",
};

const DELAY_CLASS = [
  "svc-d1","svc-d2","svc-d3","svc-d4","svc-d5","svc-d6",
  "svc-d7","svc-d8","svc-d9","svc-d10","svc-d11","svc-d12",
  "svc-d13","svc-d14","svc-d15","svc-d16","svc-d17",
];

function latencyClass(ms: number): string {
  if (ms < 100) return "svc-latency-ok";
  if (ms < 500) return "svc-latency-warn";
  return "svc-latency-error";
}

function formatCheckedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

function ServiceIcon({ service }: { service: Service }) {
  const icon = service.icon;
  const isImage = icon.startsWith("http") || icon.startsWith("/") || icon.startsWith("data:");
  const [src, setSrc] = useState(icon);
  const [imgFailed, setImgFailed] = useState(false);

  if (isImage && !imgFailed) {
    return (
      <div
        className="svc-icon-img-wrap"
        style={service.color ? { "--svc-icon-bg": service.color } as React.CSSProperties : undefined}
      >
        <img
          src={src}
          alt={service.name}
          className="svc-icon-img"
          loading="lazy"
          onError={() => {
            // PNG → SVG Fallback (dashboard-icons-Pattern)
            if (src.includes("/png/") && src.endsWith(".png")) {
              setSrc(src.replace("/png/", "/svg/").replace(/\.png$/, ".svg"));
              return;
            }
            // Letzter Fallback: Kategorie-Emoji
            setImgFailed(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className={`svc-icon-emoji ${ICON_CLASS[service.category]}`}>
      {EMOJI[service.category]}
    </div>
  );
}

export function ServiceCard({ service, pingResult, index = 0, editMode, showCategory = true }: Props) {
  const status = pingResult?.status ?? "unknown";
  const delayClass = DELAY_CLASS[index] ?? "svc-d17";
  const latencyMs = pingResult?.latencyMs ?? null;
  const checkedAt = pingResult?.checkedAt;

  const tooltipText = status === "online"
    ? `Online${latencyMs !== null ? ` · ${latencyMs}ms` : ""}${checkedAt ? ` · zuletzt ${formatCheckedAt(checkedAt)}` : ""}`
    : status === "offline"
    ? `Offline${checkedAt ? ` · zuletzt geprüft ${formatCheckedAt(checkedAt)}` : ""}`
    : "Status unbekannt";

  const cardStyle = service.color ? { "--svc-color": service.color } as React.CSSProperties : undefined;
  const lineStyle = service.color ? { background: service.color } as React.CSSProperties : undefined;

  const statusLabel =
    status === "online"
      ? latencyMs !== null ? `${latencyMs}ms` : "online"
      : status === "offline"
      ? "offline"
      : "unbekannt";

  const cardInner = (
    <>
      <span className="svc-card-line" style={lineStyle} />
      <div className="svc-top">
        <ServiceIcon service={service} />
        <span className={`svc-state svc-state-${status}`}>
          <StatusDot status={status} />
          {statusLabel}
        </span>
      </div>
      <div className="svc-body">
        <div className="svc-name">{service.name}</div>
        <div className="svc-url">
          {getHostname(service.url)}
        </div>
      </div>
      <div className="svc-foot">
        {showCategory ? <span className="svc-category-tag">{CATEGORY_LABEL[service.category]}</span> : <span />}
        <span className={`svc-latency ${latencyMs !== null ? latencyClass(latencyMs) : ""}`}>
          {status === "online" ? "online" : status}
        </span>
        {!editMode && <span className="svc-arrow"><ExternalLink size={11} /></span>}
      </div>
    </>
  );

  if (editMode) {
    return (
      <div className={`svc-card ${delayClass}`} style={cardStyle}>
        {cardInner}
      </div>
    );
  }

  return (
    <TooltipPrimitive.Provider delayDuration={400}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <a
            href={service.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`svc-card ${delayClass}`}
            style={cardStyle}
          >
            {cardInner}
          </a>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content className="svc-tooltip" side="top" sideOffset={6}>
            {tooltipText}
            <TooltipPrimitive.Arrow className="svc-tooltip-arrow" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
