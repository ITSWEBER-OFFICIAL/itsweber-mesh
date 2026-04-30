import { NextResponse } from "next/server";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type EsphomeDevice = {
  entityId: string;
  friendlyName: string;
  state: string;
  /** ISO timestamp */
  lastChanged: string;
  /** True if state !== "unavailable" / "unknown" */
  online: boolean;
};

export type EsphomeWidgetData = {
  configured: boolean;
  online: boolean;
  error?: string;
  groupEntityId?: string;
  totals: { online: number; offline: number; total: number };
  devices: EsphomeDevice[];
};

type HaState = {
  entity_id: string;
  state: string;
  attributes?: { friendly_name?: string; entity_id?: string[] };
  last_changed?: string;
  last_updated?: string;
};

function emptyData(): EsphomeWidgetData {
  return {
    configured: false,
    online: false,
    totals: { online: 0, offline: 0, total: 0 },
    devices: [],
  };
}

function isOnlineState(state: string): boolean {
  const s = state.toLowerCase();
  return s !== "unavailable" && s !== "unknown" && s !== "";
}

export async function GET(req: Request): Promise<NextResponse<EsphomeWidgetData>> {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const cfg = readConfig();
  const ha = cfg.integrations.homeAssistant;

  if (!ha.baseUrl || !ha.token) {
    return NextResponse.json({ ...emptyData(), configured: false });
  }
  if (!ha.esphomeGroupEntity) {
    return NextResponse.json({
      ...emptyData(),
      configured: false,
      error: "Setze 'esphomeGroupEntity' (z.B. 'group.esphome_devices') in der HA-Integration",
    });
  }

  const baseUrl = ha.baseUrl.replace(/\/+$/, "");
  const groupId = ha.esphomeGroupEntity;

  try {
    // 1. Fetch group entity to get member list
    const groupRes = await fetch(`${baseUrl}/api/states/${encodeURIComponent(groupId)}`, {
      headers: { authorization: `Bearer ${ha.token}`, accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!groupRes.ok) {
      return NextResponse.json({
        ...emptyData(),
        configured: true,
        online: false,
        groupEntityId: groupId,
        error: `HA HTTP ${groupRes.status} — Group '${groupId}' nicht gefunden?`,
      });
    }
    const group = (await groupRes.json()) as HaState;
    const members = group.attributes?.entity_id ?? [];

    if (members.length === 0) {
      return NextResponse.json({
        ...emptyData(),
        configured: true,
        online: true,
        groupEntityId: groupId,
        error: "Group hat keine Mitglieder",
      });
    }

    // 2. Fetch all states once and filter (avoids N+1)
    const allRes = await fetch(`${baseUrl}/api/states`, {
      headers: { authorization: `Bearer ${ha.token}`, accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!allRes.ok) {
      return NextResponse.json({
        ...emptyData(),
        configured: true,
        online: false,
        groupEntityId: groupId,
        error: `HA HTTP ${allRes.status} beim Laden aller States`,
      });
    }
    const allStates = (await allRes.json()) as HaState[];
    const stateMap = new Map(allStates.map((s) => [s.entity_id, s]));

    const devices: EsphomeDevice[] = members.map((memberId) => {
      const s = stateMap.get(memberId);
      const state = s?.state ?? "unavailable";
      return {
        entityId: memberId,
        friendlyName: s?.attributes?.friendly_name ?? memberId,
        state,
        lastChanged: s?.last_changed ?? s?.last_updated ?? "",
        online: isOnlineState(state),
      };
    });

    const onlineCount = devices.filter((d) => d.online).length;

    return NextResponse.json({
      configured: true,
      online: true,
      groupEntityId: groupId,
      totals: {
        online: onlineCount,
        offline: devices.length - onlineCount,
        total: devices.length,
      },
      devices,
    });
  } catch (err) {
    return NextResponse.json({
      ...emptyData(),
      configured: true,
      online: false,
      groupEntityId: groupId,
      error: err instanceof Error ? err.message : "HA-Verbindung fehlgeschlagen",
    });
  }
}
