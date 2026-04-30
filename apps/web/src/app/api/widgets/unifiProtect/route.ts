import { NextResponse } from "next/server";
import { Agent as HttpsAgent } from "node:https";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";

export type ProtectCamera = {
  id: string;
  name: string;
  type: string;                       // model string e.g. "UVC G4 Pro"
  state: "CONNECTED" | "DISCONNECTED" | string;
  isRecording: boolean;
  recordingMode: "always" | "motion" | "never" | string;
  isMotionDetected: boolean;
  isDoorbell: boolean;
  isDark: boolean;
  lastMotion: number | null;          // unix ms
  lastRing: number | null;            // unix ms — doorbells only
  uptime: number | null;              // seconds
  snapshotUrl: string;
  smartDetectTypes: string[];         // e.g. ["person","vehicle","package"]
};

export type ProtectSummary = {
  total: number;
  online: number;
  recording: number;
  motionActive: number;
  doorbells: number;
};

export type UnifiProtectWidgetData = {
  configured: boolean;
  online: boolean;
  cameras?: ProtectCamera[];
  summary?: ProtectSummary;
  error?: string;
};

type RawCamera = {
  id: string;
  name: string;
  type?: string;
  modelKey?: string;
  state: string;
  isRecording?: boolean;
  isMotionDetected?: boolean;
  isDark?: boolean;
  lastMotion?: number | null;
  lastRing?: number | null;
  uptime?: number | null;
  featureFlags?: {
    smartDetectTypes?: string[];
    hasMic?: boolean;
    hasSpeaker?: boolean;
  };
  recordingSettings?: {
    mode?: string;
  };
};

function protectFetch<T>(
  baseUrl: string,
  path: string,
  apiKey: string,
  verifyTls: boolean,
): Promise<T> {
  const u = new URL(path, baseUrl);
  const isHttps = u.protocol === "https:";
  const reqFn = isHttps ? httpsRequest : httpRequest;
  const httpsOpts = isHttps ? { agent: new HttpsAgent({ rejectUnauthorized: verifyTls }) } : {};

  return new Promise((resolve, reject) => {
    const req = reqFn(
      u,
      { method: "GET", headers: { "X-API-Key": apiKey, Accept: "application/json" }, ...httpsOpts },
      (res) => {
        let data = "";
        res.on("data", (c: Buffer) => { data += c.toString(); });
        res.on("end", () => {
          if ((res.statusCode ?? 0) >= 400) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
          try { resolve(JSON.parse(data) as T); } catch (e) { reject(e); }
        });
      },
    );
    req.setTimeout(8000, () => { req.destroy(); reject(new Error("Timeout")); });
    req.on("error", reject);
    req.end();
  });
}

function isDoorbell(raw: RawCamera): boolean {
  const t = (raw.type ?? raw.modelKey ?? "").toLowerCase();
  return t.includes("doorbell") || t.includes("door") || t.includes("uvc-g4-doorbell") || t.includes("uvc-g4db");
}

export async function GET(req: Request) {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const cfg = readConfig();
  const p = cfg.integrations.unifiProtect;

  if (!p?.enabled || !p?.baseUrl || !p?.apiKey) {
    return NextResponse.json({ configured: false, online: false } satisfies UnifiProtectWidgetData);
  }

  const { baseUrl, apiKey, verifyTls = false } = p;

  try {
    const raw = await protectFetch<RawCamera[]>(
      baseUrl,
      "/proxy/protect/integration/v1/cameras",
      apiKey,
      verifyTls,
    );

    const cameras: ProtectCamera[] = raw.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type ?? c.modelKey ?? "UVC Camera",
      state: c.state,
      isRecording: c.isRecording ?? false,
      recordingMode: c.recordingSettings?.mode ?? "unknown",
      isMotionDetected: c.isMotionDetected ?? false,
      isDoorbell: isDoorbell(c),
      isDark: c.isDark ?? false,
      lastMotion: c.lastMotion ?? null,
      lastRing: c.lastRing ?? null,
      uptime: c.uptime ?? null,
      snapshotUrl: `/api/widgets/unifiProtect/snapshot/${c.id}`,
      smartDetectTypes: c.featureFlags?.smartDetectTypes ?? [],
    }));

    const summary: ProtectSummary = {
      total: cameras.length,
      online: cameras.filter((c) => c.state === "CONNECTED").length,
      recording: cameras.filter((c) => c.isRecording).length,
      motionActive: cameras.filter((c) => c.isMotionDetected).length,
      doorbells: cameras.filter((c) => c.isDoorbell).length,
    };

    return NextResponse.json({
      configured: true,
      online: true,
      cameras,
      summary,
    } satisfies UnifiProtectWidgetData);
  } catch (err) {
    return NextResponse.json({
      configured: true,
      online: false,
      error: err instanceof Error ? err.message : "Verbindungsfehler",
    } satisfies UnifiProtectWidgetData);
  }
}
