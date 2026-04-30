import { NextResponse } from "next/server";
import { readConfig } from "@/server/config/store";
import { pingTarget, type PingResult } from "@/server/healthcheck/pinger";
import pLimit from "p-limit";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";

export type NetworkWidgetEntry = {
  id: string;
  label: string;
  sub?: string;
  iconEmoji: string;
  url?: string;
  status: PingResult["status"];
  latencyMs?: number;
};

export type NetworkWidgetData = {
  entries: NetworkWidgetEntry[];
};

export async function GET(req: Request) {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const cfg = readConfig();
  const devices = cfg.networkDevices.filter((d) => d.enabled).sort((a, b) => a.sortOrder - b.sortOrder);

  const limit = pLimit(8);
  const entries: NetworkWidgetEntry[] = await Promise.all(
    devices.map((d) =>
      limit(async () => {
        const result = await pingTarget(d.healthCheck, d.url);
        const entry: NetworkWidgetEntry = {
          id: d.id,
          label: d.label,
          iconEmoji: d.iconEmoji,
          status: result.status,
        };
        if (d.sub !== undefined) entry.sub = d.sub;
        if (d.url !== undefined) entry.url = d.url;
        if (result.latencyMs !== null && result.latencyMs !== undefined) entry.latencyMs = result.latencyMs;
        return entry;
      }),
    ),
  );

  return NextResponse.json({ entries } satisfies NetworkWidgetData);
}
