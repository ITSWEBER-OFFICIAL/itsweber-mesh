#!/usr/bin/env node
// Verifies that `next build` does not write to /data/config.json.
//
// Strategy:
// 1. Create an isolated temp DATA_DIR with a known config snapshot (mtime + bytes).
// 2. Run `next build` against that DATA_DIR.
// 3. Re-stat the config; if the file was touched (mtime moved or bytes changed)
//    the build is no longer build-safe and we exit non-zero.
// 4. Repeat with the DATA_DIR completely empty (no config.json) — file must
//    still not exist after build.
//
// This guards against P1-1 regressions where readConfig() leaks into a
// statically rendered page and triggers ensureConfigFile()/migration writes
// during NEXT_PHASE === "phase-production-build".

import { mkdtempSync, writeFileSync, readFileSync, statSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = resolve(__dirname, "..");

function runBuild(dataDir) {
  const result = spawnSync("pnpm", ["exec", "next", "build"], {
    cwd: WEB_DIR,
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  // We intentionally do NOT fail on non-zero exit. The test only cares about
  // whether `config.json` was touched during build — not whether the trace /
  // standalone post-processing step succeeded (that step fails on Windows due
  // to symlink permissions, which is unrelated to build-safety).
  if (result.status !== 0) {
    console.warn(
      `(warn) next build exited with status ${result.status ?? "unknown"} — ` +
        "continuing anyway, the relevant phases are page-data + static-generation.",
    );
  }
}

function snapshot(path) {
  if (!existsSync(path)) return null;
  const st = statSync(path);
  const bytes = readFileSync(path);
  return { mtimeMs: st.mtimeMs, size: st.size, sha: hashOf(bytes) };
}

function hashOf(bytes) {
  // Cheap hash — we only need to detect any byte-level change.
  let h = 0n;
  for (const byte of bytes) {
    h = (h * 131n + BigInt(byte)) & 0xffffffffffffffffn;
  }
  return h.toString(16);
}

function expect(cond, msg) {
  if (!cond) {
    console.error(`✗ ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

const tmpRoot = mkdtempSync(join(tmpdir(), "mesh-buildsafe-"));
const dataDir = join(tmpRoot, "data");

// ── Case A: DATA_DIR contains a fully migrated config — must not be touched ─
{
  rmSync(dataDir, { recursive: true, force: true });
  const fs = await import("node:fs");
  fs.mkdirSync(dataDir, { recursive: true });
  const cfgPath = join(dataDir, "config.json");
  const seedPath = resolve(WEB_DIR, "src/server/config/defaults.ts");
  // Hand-rolled minimal v13 config — we only care about file-level
  // identity, not schema correctness; the build path must never touch it.
  const seed = JSON.stringify({ version: 13, _seed: "build-safe-marker" }, null, 2);
  writeFileSync(cfgPath, seed, "utf8");
  // Backdate mtime so a near-instant write would still register as a change.
  const oldMtime = new Date(Date.now() - 60_000);
  fs.utimesSync(cfgPath, oldMtime, oldMtime);

  console.log(`\n=== Case A: pre-existing config.json at ${cfgPath} ===`);
  if (!existsSync(seedPath)) {
    console.error(`Expected defaults.ts at ${seedPath}`);
    process.exit(1);
  }
  const before = snapshot(cfgPath);
  runBuild(dataDir);
  const after = snapshot(cfgPath);

  expect(after !== null, "config.json still exists after build");
  expect(before.size === after.size, "config.json size unchanged");
  expect(before.sha === after.sha, "config.json bytes unchanged");
  expect(before.mtimeMs === after.mtimeMs, "config.json mtime unchanged");
}

// ── Case B: DATA_DIR is empty — build must not create config.json ───────────
{
  rmSync(dataDir, { recursive: true, force: true });
  const fs = await import("node:fs");
  fs.mkdirSync(dataDir, { recursive: true });
  const cfgPath = join(dataDir, "config.json");

  console.log(`\n=== Case B: empty DATA_DIR at ${dataDir} ===`);
  expect(!existsSync(cfgPath), "config.json absent before build");
  runBuild(dataDir);
  expect(!existsSync(cfgPath), "config.json absent after build (no write during SSG)");
}

console.log("\nAll build-safe checks passed.");
process.exit(0);
