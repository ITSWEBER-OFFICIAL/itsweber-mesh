import lockfile from "proper-lockfile";
import { ConfigSchema, type Config } from "./schema";
import { defaultConfig } from "./defaults";
import { runMigrations } from "./migrations";
import { logger } from "../logger";

const DATA_DIR = process.env["DATA_DIR"] ?? "/data";
const CONFIG_PATH = `${DATA_DIR}/config.json`;

const BUILD_PHASE = "phase-production-build";

function isBuildPhase(): boolean {
  return process.env["NEXT_PHASE"] === BUILD_PHASE;
}

function nodeFs(): typeof import("fs") {
  const loadBuiltin = process.getBuiltinModule as
    | ((specifier: "fs") => typeof import("fs"))
    | undefined;
  if (loadBuiltin) return loadBuiltin("fs");

  const loadRequire = new Function("return typeof require === 'function' ? require : null") as
    () => NodeJS.Require | null;
  const requireFn = loadRequire();
  if (!requireFn) {
    throw new Error("Node.js fs module is unavailable in this runtime.");
  }
  return requireFn("fs") as typeof import("fs");
}

function ensureDataDir() {
  const fs = nodeFs();
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function ensureConfigFile() {
  ensureDataDir();
  const fs = nodeFs();
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), "utf8");
    logger.info({ path: CONFIG_PATH }, "Config initialised with defaults");
  }
}

function readJsonConfig(): Record<string, unknown> {
  const raw = nodeFs().readFileSync(CONFIG_PATH, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw) as Record<string, unknown>;
}

/** Backup the current config file before a schema migration overwrites it. */
function backupBeforeMigration(fromVersion: number) {
  const backupPath = `${CONFIG_PATH}.pre-v${fromVersion}`;
  // Don't overwrite an existing backup (would obliterate the original on multi-restart)
  const fs = nodeFs();
  if (fs.existsSync(backupPath)) return;
  try {
    fs.copyFileSync(CONFIG_PATH, backupPath);
    logger.info({ backupPath, fromVersion }, "Pre-migration config backup written");
  } catch (err) {
    logger.warn({ err, backupPath }, "Failed to write pre-migration backup");
  }
}

/** Internal: parse + migrate without any side effect. Returns null if validation fails. */
function parseAndMigrate(raw: Record<string, unknown>): { config: Config; rawVersion: number } | null {
  const rawVersion = (raw["version"] as number) ?? 1;
  const migrated = runMigrations(raw);
  const result = ConfigSchema.safeParse(migrated);
  if (!result.success) {
    logger.error({ errors: result.error.flatten() }, "Config validation failed");
    return null;
  }
  return { config: result.data, rawVersion };
}

/**
 * Runtime config read. Hard-guard: throws if invoked during the production
 * build phase (NEXT_PHASE === "phase-production-build"). Use
 * {@link readConfigForBuild} from server components that may execute during
 * SSG instead.
 *
 * Does NOT persist anything to disk. Migration persistence is owned by
 * {@link bootstrapConfigForRuntime}, which runs once from `instrumentation.ts`.
 */
export function readConfig(): Config {
  if (isBuildPhase()) {
    throw new Error(
      "readConfig() must not be called during `next build` (NEXT_PHASE === 'phase-production-build'). " +
        "Use readConfigForBuild() in server components rendered at build time.",
    );
  }
  ensureConfigFile();
  const raw = readJsonConfig();
  const parsed = parseAndMigrate(raw);
  return parsed ? parsed.config : defaultConfig;
}

/**
 * Build-safe config read. Returns defaults when the config file is missing
 * (e.g. during `next build` where /data is not mounted). Performs migrations
 * in-memory only — never writes to disk.
 */
export function readConfigForBuild(): Config {
  const fs = nodeFs();
  if (!fs.existsSync(CONFIG_PATH)) {
    return defaultConfig;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8").replace(/^\uFEFF/, "")) as Record<
      string,
      unknown
    >;
    const parsed = parseAndMigrate(raw);
    return parsed ? parsed.config : defaultConfig;
  } catch (err) {
    logger.warn({ err }, "readConfigForBuild() failed — falling back to defaults");
    return defaultConfig;
  }
}

/**
 * Runtime bootstrap. Ensures the config file exists, runs migrations, and
 * persists the migrated result to disk. Must be called exactly once on server
 * startup from `instrumentation.ts`. Refuses to run during the build phase.
 */
export function bootstrapConfigForRuntime(): Config {
  if (isBuildPhase()) {
    throw new Error("bootstrapConfigForRuntime() must not run during `next build`.");
  }
  ensureConfigFile();
  const raw = readJsonConfig();
  const parsed = parseAndMigrate(raw);
  if (!parsed) {
    logger.error("Config invalid at bootstrap — using defaults (NOT persisted)");
    return defaultConfig;
  }
  if (parsed.rawVersion !== parsed.config.version) {
    backupBeforeMigration(parsed.rawVersion);
    try {
      nodeFs().writeFileSync(CONFIG_PATH, JSON.stringify(parsed.config, null, 2), "utf8");
      logger.info(
        { from: parsed.rawVersion, to: parsed.config.version },
        "Config migrated and persisted",
      );
    } catch (err) {
      logger.warn({ err }, "Could not persist migrated config (will retry on next write)");
    }
  }
  return parsed.config;
}

export async function writeConfig(config: Config): Promise<void> {
  if (isBuildPhase()) {
    throw new Error("writeConfig() must not run during `next build`.");
  }
  ensureConfigFile();

  let release: (() => Promise<void>) | null = null;
  try {
    release = await lockfile.lock(CONFIG_PATH, { retries: { retries: 5, minTimeout: 50 } });
    nodeFs().writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
  } finally {
    if (release) await release();
  }
}

/**
 * Atomically read-modify-write the config under a file lock.
 * The read happens inside the lock so two concurrent callers can never
 * both read the same stale state and then overwrite each other's changes.
 */
export async function patchConfig(patch: Partial<Config>): Promise<Config> {
  if (isBuildPhase()) {
    throw new Error("patchConfig() must not run during `next build`.");
  }
  ensureConfigFile();

  let release: (() => Promise<void>) | null = null;
  try {
    release = await lockfile.lock(CONFIG_PATH, { retries: { retries: 5, minTimeout: 50 } });
    const raw = readJsonConfig();
    const parsed = parseAndMigrate(raw);
    const current = parsed ? parsed.config : defaultConfig;
    const updated = { ...current, ...patch };
    nodeFs().writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), "utf8");
    return updated;
  } finally {
    if (release) await release();
  }
}
