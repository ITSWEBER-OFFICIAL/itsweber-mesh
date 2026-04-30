"use client";

import type { InfraNode } from "@/server/config/schema";
import type { UnraidWidgetData, UnraidInstanceData } from "@/app/api/widgets/unraid/route";
import type { GlancesWidgetData, GlancesInstanceData } from "@/app/api/widgets/glances/route";
import { WidgetLinkWrapper } from "@/components/ui/WidgetLinkWrapper";

type Props = {
  node: InfraNode;
  unraid: UnraidWidgetData | undefined;
  glances: GlancesWidgetData | undefined;
  editMode?: boolean;
};

function findUnraidData(
  node: InfraNode,
  unraid: UnraidWidgetData | undefined,
): { online: boolean; data?: UnraidInstanceData; error?: string } {
  if (!unraid || !node.integrationRef) return { online: false };
  const inst = unraid.instances.find((i) => i.id === node.integrationRef!.id);
  if (!inst) return { online: false };
  if (!inst.online) return { online: false, error: inst.error };
  return { online: true, data: inst.data };
}

function findGlancesData(
  node: InfraNode,
  glances: GlancesWidgetData | undefined,
): { online: boolean; data?: GlancesInstanceData } {
  if (!glances || !node.glancesRef) return { online: false };
  const inst = glances.instances.find((i) => i.id === node.glancesRef!.id);
  if (!inst || !inst.online) return { online: false };
  return { online: true, data: inst.data };
}

function formatPercent(p: number | undefined): string {
  if (p === undefined || Number.isNaN(p)) return "—";
  return `${p < 10 ? p.toFixed(1) : Math.round(p)}%`;
}

export function InfraNodeCard({ node, unraid, glances, editMode }: Props) {
  const u = findUnraidData(node, unraid);
  const g = findGlancesData(node, glances);
  const ud = u.data;
  const gd = g.data;

  // Live-CPU% / RAM% bevorzugt aus Glances, statisch aus Unraid
  const cpuPercent = gd?.cpu.percent;
  const cores = gd?.cpu.cores ?? ud?.cpu?.cores;
  const threads = ud?.cpu?.threads;
  const cpuBrand = ud?.cpu?.brand;

  const ramPercent = gd?.memory.percent;
  const ramUsedGb = gd?.memory.usedGb;
  const ramTotalGb = gd?.memory.totalGb ?? ud?.memoryTotalGb;

  const arrPct = ud?.array?.capacity?.percent;
  const arrUsed = ud?.array?.capacity?.usedTb;
  const arrTotal = ud?.array?.capacity?.totalTb;

  const version = node.versionOverride ?? ud?.unraidVersion;
  const isOnline = u.online || g.online;

  return (
    <WidgetLinkWrapper href={node.linkUrl ?? undefined} className="card infra-card" editMode={editMode}>
      <div className="server-head">
        <div className="server-name-wrap">
          <div className="name">{node.iconEmoji} {node.label}</div>
          <div className="ip">
            {node.ip ?? gd?.hostname ?? "—"}
            {version && ` · Unraid ${version}`}
            {!version && gd?.os && ` · ${gd.os}`}
          </div>
        </div>
        <span className={`badge ${node.primary ? "badge-teal" : "badge-dim"}`}>{node.badge}</span>
      </div>

      {/* CPU */}
      <div className="stat">
        <div className="stat-head">
          <span>CPU</span>
          <span title={cpuBrand}>
            {cpuPercent !== undefined
              ? `${formatPercent(cpuPercent)}${cores ? ` · ${cores}C${threads ? ` / ${threads}T` : ""}` : ""}`
              : cores
              ? `${cores}C${threads ? ` / ${threads}T` : ""}`
              : "—"}
          </span>
        </div>
        {cpuPercent !== undefined ? (
          <div className="track">
            <div
              className={`fill ${cpuPercent > 85 ? "fill-amber" : "fill-teal"}`}
              style={{ width: `${Math.min(100, cpuPercent)}%` }}
            />
          </div>
        ) : (
          <div className="stat-meta">{cpuBrand ?? (isOnline ? "Live-Auslastung n. v. — Glances installieren" : "Offline")}</div>
        )}
      </div>

      {/* RAM */}
      <div className="stat">
        <div className="stat-head">
          <span>RAM</span>
          <span>
            {ramPercent !== undefined
              ? `${formatPercent(ramPercent)} · ${ramUsedGb} / ${ramTotalGb} GB`
              : ramTotalGb !== undefined
              ? `${ramTotalGb} GB`
              : "—"}
          </span>
        </div>
        {ramPercent !== undefined ? (
          <div className="track">
            <div
              className={`fill ${ramPercent > 85 ? "fill-amber" : "fill-teal2"}`}
              style={{ width: `${Math.min(100, ramPercent)}%` }}
            />
          </div>
        ) : (
          <div className="stat-meta">{ramTotalGb !== undefined ? "Gesamt installiert" : "—"}</div>
        )}
      </div>

      {/* ARRAY */}
      {arrPct !== undefined ? (
        <div className="stat">
          <div className="stat-head">
            <span>ARRAY</span>
            <span>{formatPercent(arrPct)} · {arrUsed} / {arrTotal} TB</span>
          </div>
          <div className="track">
            <div
              className={`fill ${arrPct > 85 ? "fill-amber" : "fill-green"}`}
              style={{ width: `${Math.min(100, arrPct)}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* Chips */}
      {(node.chips.length > 0 || ud?.containers || ud?.vms) && (
        <div className="server-chips">
          {node.chips.map((chip) => (
            <span key={chip} className="chip">{chip}</span>
          ))}
          {ud?.containers && (
            <span className="chip">{ud.containers.running}/{ud.containers.total} Container</span>
          )}
          {ud?.vms && ud.vms.total > 0 && (
            <span className="chip">{ud.vms.running}/{ud.vms.total} VMs</span>
          )}
        </div>
      )}

      {!isOnline && u.error && (
        <div className="infra-error">⚠ {u.error}</div>
      )}
    </WidgetLinkWrapper>
  );
}
