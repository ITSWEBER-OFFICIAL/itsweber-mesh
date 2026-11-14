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

/**
 * Fallback for an existing but unreadable config (invalid JSON, failed
 * validation, or written by a newer version). Never "open": token mode denies
 * everything unless ADMIN_TOKEN is set, so a broken file cannot unlock the
 * dashboard.
 */
export const lockedConfig: Config = {
  ...defaultConfig,
  auth: { ...defaultConfig.auth, mode: "token" },
};

export class ConfigInvalidError extends Error {
  constructor() {
    super("config.json is invalid or from a newer version; refusing to overwrite it. Restore a backup.");
    this.name = "ConfigInvalidError";
  }
}

/** Write via temp file + rename so a crash never leaves a half-written config. */
function writeJsonAtomic(config: Config) {
  const fs = nodeFs();
  const tmp = `${CONFIG_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2), "utf8");
  fs.renameSync(tmp, CONFIG_PATH);
}

/** Read + validate the file on disk. Returns null when it cannot be trusted. */
function readParsed(): { config: Config; rawVersion: number } | null {
  try {
    return parseAndMigrate(readJsonConfig());
  } catch (err) {
    logger.error({ err }, "Config file unreadable");
    return null;
  }
}

function readJsonConfig(): Record<string, unknown> {
  const raw = nodeFs().readFileSync(CONFIG_PATH, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw) as Record<string, unknown>;
}

/** Backup the current config file before a schema migration overwrites it. Returns false if no backup exists afterwards. */
function backupBeforeMigration(fromVersion: number): boolean {
  const backupPath = `${CONFIG_PATH}.pre-v${fromVersion}`;
  // Don't overwrite an existing backup (would obliterate the original on multi-restart)
  const fs = nodeFs();
  if (fs.existsSync(backupPath)) return true;
  try {
    fs.copyFileSync(CONFIG_PATH, backupPath);
    logger.info({ backupPath, fromVersion }, "Pre-migration config backup written");
    return true;
  } catch (err) {
    logger.error({ err, backupPath }, "Failed to write pre-migration backup");
    return false;
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
  const parsed = readParsed();
  return parsed ? parsed.config : lockedConfig;
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
    return parsed ? parsed.config : lockedConfig;
  } catch (err) {
    logger.warn({ err }, "readConfigForBuild() failed — falling back to defaults");
    return lockedConfig;
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
  const parsed = readParsed();
  if (!parsed) {
    logger.error("Config invalid at bootstrap — auth locked, file left untouched");
    return lockedConfig;
  }
  if (parsed.rawVersion !== parsed.config.version) {
    if (!backupBeforeMigration(parsed.rawVersion)) {
      logger.error("No pre-migration backup — migrated config kept in memory only");
      return parsed.config;
    }
    try {
      writeJsonAtomic(parsed.config);
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
    if (!readParsed()) throw new ConfigInvalidError();
    writeJsonAtomic(config);
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
    const parsed = readParsed();
    if (!parsed) throw new ConfigInvalidError();
    const updated = { ...parsed.config, ...patch };
    writeJsonAtomic(updated);
    return updated;
  } finally {
    if (release) await release();
  }
}
