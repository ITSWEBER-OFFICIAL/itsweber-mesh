"use client";

import type { PingStatus } from "@/server/healthcheck/pinger";

type Props = { status: PingStatus; className?: string };

const styles: Record<PingStatus, string> = {
  online:  "bg-[var(--status-ok)]  animate-[pulse-ok_2s_ease-in-out_infinite]",
  offline: "bg-[var(--status-error)]",
  unknown: "bg-[var(--dim)]",
};

const labels: Record<PingStatus, string> = {
  online:  "ONLINE",
  offline: "OFFLINE",
  unknown: "—",
};

const labelStyles: Record<PingStatus, string> = {
  online:  "text-[var(--status-ok)]",
  offline: "text-[var(--status-error)]",
  unknown: "text-[var(--dim)]",
};

export function StatusDot({ status, className }: Props) {
  return (
    <span
      className={`flex items-center gap-[5px] font-mono text-[9px] tracking-[1px] ${labelStyles[status]} ${className ?? ""}`}
    >
      <span className={`w-[5px] h-[5px] rounded-full flex-shrink-0 ${styles[status]}`} />
      {labels[status]}
    </span>
  );
}
