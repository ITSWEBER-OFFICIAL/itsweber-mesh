import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/server/auth/api-auth";
import { readConfig, writeConfig } from "@/server/config/store";
import { ConfigSchema } from "@/server/config/schema";
import { runMigrations } from "@/server/config/migrations";
import { logger } from "@/server/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATA_DIR = process.env["DATA_DIR"] ?? "/data";
const CONFIG_PATH = `${DATA_DIR}/config.json`;

// ── Export ──────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const deny = await requireApiAdmin(req);
  if (deny) return deny;

  const config = readConfig();
  const json = JSON.stringify(config, null, 2);

  // Filename: itsweber-mesh-backup-2026-04-30-1430.json
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const filename = `itsweber-mesh-backup-${stamp}.json`;

  return new Response(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// ── Import / Restore ─────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const deny = await requireApiAdmin(req);
  if (deny) return deny;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültige JSON-Datei" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Datei enthält kein JSON-Objekt" }, { status: 400 });
  }

  // Run the full migration chain on the uploaded config
  const raw = body as Record<string, unknown>;
  const fromVersion = (raw["version"] as number | undefined) ?? 1;
  let migrated: Record<string, unknown>;
  try {
    migrated = runMigrations(raw);
  } catch (err) {
    logger.warn({ err }, "Backup restore: migration failed");
    return NextResponse.json({ ok: false, error: "Backup konnte nicht migriert werden" }, { status: 422 });
  }

  const parsed = ConfigSchema.safeParse(migrated);
  if (!parsed.success) {
    const issues = parsed.error.flatten().fieldErrors;
    logger.warn({ issues }, "Backup restore: schema validation failed");
    return NextResponse.json(
      { ok: false, error: "Backup-Datei hat ein ungültiges Schema", issues },
      { status: 422 },
    );
  }

  // Backup current config before overwriting
  try {
    const fs = await import("node:fs");
    const backupPath = `${CONFIG_PATH}.pre-restore`;
    fs.copyFileSync(CONFIG_PATH, backupPath);
    logger.info({ backupPath }, "Pre-restore backup written");
  } catch (err) {
    logger.warn({ err }, "Could not write pre-restore backup (non-fatal)");
  }

  // Ensure firstRunCompleted=true when the backup already contains users or
  // uses oauth2 — a stale flag from the source install shouldn't force setup.
  const restoredConfig =
    parsed.data.auth.users.length > 0 || parsed.data.auth.mode === "oauth2"
      ? { ...parsed.data, meta: { ...parsed.data.meta, firstRunCompleted: true } }
      : parsed.data;

  try {
    await writeConfig(restoredConfig);
  } catch (err) {
    logger.error({ err }, "Backup restore: writeConfig failed");
    return NextResponse.json({ ok: false, error: "Konfiguration konnte nicht geschrieben werden" }, { status: 500 });
  }

  logger.info({ fromVersion, toVersion: parsed.data.version }, "Config restored from backup");
  return NextResponse.json({
    ok: true,
    fromVersion,
    toVersion: parsed.data.version,
  });
}
