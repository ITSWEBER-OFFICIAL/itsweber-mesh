import { NextResponse } from "next/server";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";

export type FrigateCamera = {
  name: string;
  fps: number;
  detectionEnabled: boolean;
};

export type FrigateEvent = {
  id: string;
  camera: string;
  label: string;
  topScore: number | null;
  startTime: number;
  hasSnapshot: boolean;
  snapshotUrl: string; // server-side proxy
};

export type FrigateStats = {
  totalFps: number;
  detectionFps: number;
  cpuUsage?: number | undefined;
};

export type FrigateWidgetData = {
  configured: boolean;
  online: boolean;
  cameras?: FrigateCamera[];
  recentEvents?: FrigateEvent[];
  stats?: FrigateStats;
  error?: string;
};

type RawEvent = {
  id: string;
  camera: string;
  label: string;
  top_score: number | null;
  start_time: number;
  has_snapshot: boolean;
};

type RawStats = {
  camera_fps: number;
  detection_fps: number;
  cameras: Record<string, { camera_fps: number; detection_fps: number; detection_enabled: boolean }>;
  cpu_usages?: Record<string, { cpu: string }>;
};

async function frigateFetch<T>(baseUrl: string, path: string): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function GET(req: Request) {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const cfg = readConfig();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const instances = cfg.integrations.frigate;
  const f = id ? instances.find((i) => i.id === id) : instances[0];

  if (!f?.baseUrl) {
    return NextResponse.json({ configured: false, online: false } satisfies FrigateWidgetData);
  }

  const baseUrl = f.baseUrl.replace(/\/$/, "");

  try {
    const [statsRaw, eventsRaw] = await Promise.all([
      frigateFetch<RawStats>(baseUrl, "/api/stats"),
      frigateFetch<RawEvent[]>(baseUrl, "/api/events?limit=5&has_snapshot=1"),
    ]);

    const cameras: FrigateCamera[] = Object.entries(statsRaw.cameras ?? {}).map(([name, c]) => ({
      name,
      fps: Math.round(c.camera_fps * 10) / 10,
      detectionEnabled: c.detection_enabled,
    }));

    // Average CPU across all usages if available
    let cpuUsage: number | undefined;
    if (statsRaw.cpu_usages) {
      const vals = Object.values(statsRaw.cpu_usages)
        .map((v) => parseFloat(v.cpu))
        .filter((v) => !isNaN(v));
      if (vals.length) cpuUsage = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    }

    const recentEvents: FrigateEvent[] = eventsRaw.map((e) => ({
      id: e.id,
      camera: e.camera,
      label: e.label,
      topScore: e.top_score !== null ? Math.round((e.top_score) * 100) : null,
      startTime: e.start_time,
      hasSnapshot: e.has_snapshot,
      snapshotUrl: `/api/widgets/frigate/snapshot/${e.id}`,
    }));

    return NextResponse.json({
      configured: true,
      online: true,
      cameras,
      recentEvents,
      stats: {
        totalFps: Math.round(statsRaw.camera_fps * 10) / 10,
        detectionFps: Math.round(statsRaw.detection_fps * 10) / 10,
        cpuUsage,
      },
    } satisfies FrigateWidgetData);
  } catch (err) {
    return NextResponse.json({
      configured: true,
      online: false,
      error: err instanceof Error ? err.message : "Verbindungsfehler",
    } satisfies FrigateWidgetData);
  }
}
