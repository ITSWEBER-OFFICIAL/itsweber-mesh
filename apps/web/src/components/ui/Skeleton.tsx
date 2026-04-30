"use client";

import type { CSSProperties } from "react";

type Props = {
  width?: number | string;
  height?: number | string;
  rounded?: "sm" | "md" | "lg" | "full";
  className?: string;
  style?: CSSProperties;
};

const RADIUS = {
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  full: "999px",
};

export function Skeleton({ width, height, rounded = "md", className = "", style }: Props) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton-shimmer ${className}`}
      style={{
        display: "block",
        width: typeof width === "number" ? `${width}px` : width ?? "100%",
        height: typeof height === "number" ? `${height}px` : height ?? "1em",
        borderRadius: RADIUS[rounded],
        ...style,
      }}
    />
  );
}

/** Generic widget loading state. compact = horizontal/short for non-sidebar slots. */
export function WidgetSkeleton({ compact = false, label }: { compact?: boolean; label?: string }) {
  if (compact) {
    return (
      <div className="widget-card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 12, minHeight: 88 }}>
        <Skeleton width={44} height={44} rounded="md" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <Skeleton width="40%" height={10} />
          <Skeleton width="70%" height={20} />
          <Skeleton width="55%" height={10} />
        </div>
      </div>
    );
  }
  return (
    <div className="widget-card">
      <span className="widget-accent" />
      <div className="widget-header">
        <Skeleton width={14} height={14} rounded="sm" />
        <Skeleton width={120} height={12} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
        {label ? (
          <span className="widget-hint" style={{ fontSize: 10, color: "var(--dim)" }}>
            {label} lädt…
          </span>
        ) : null}
        <Skeleton height={14} />
        <Skeleton width="80%" height={14} />
        <Skeleton width="60%" height={14} />
      </div>
    </div>
  );
}
