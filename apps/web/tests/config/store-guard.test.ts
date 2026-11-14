import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "mesh-store-"));
process.env["DATA_DIR"] = dir;
const file = join(dir, "config.json");

const store = await import("@/server/config/store");
const { defaultConfig } = await import("@/server/config/defaults");
const { CURRENT_VERSION } = await import("@/server/config/migrations");

const valid = () => JSON.stringify({ ...defaultConfig, auth: { ...defaultConfig.auth, mode: "userPassword" } });

describe("config store fails closed", () => {
  beforeEach(() => writeFileSync(file, valid(), "utf8"));

  it("reads a valid config unchanged", () => {
    expect(store.readConfig().auth.mode).toBe("userPassword");
  });

  it.each([
    ["broken JSON", "{ not json"],
    ["failed validation", JSON.stringify({ version: CURRENT_VERSION, theme: 5 })],
    ["newer version", JSON.stringify({ ...defaultConfig, version: CURRENT_VERSION + 1 })],
  ])("locks auth on %s instead of opening", (_name, content) => {
    writeFileSync(file, content, "utf8");
    expect(store.readConfig().auth.mode).toBe("token");
    expect(store.bootstrapConfigForRuntime().auth.mode).toBe("token");
    expect(readFileSync(file, "utf8")).toBe(content);
  });

  it("refuses to overwrite an invalid file", async () => {
    writeFileSync(file, "{ not json", "utf8");
    await expect(store.patchConfig({ meta: defaultConfig.meta })).rejects.toThrow(store.ConfigInvalidError);
    await expect(store.writeConfig(defaultConfig)).rejects.toThrow(store.ConfigInvalidError);
    expect(readFileSync(file, "utf8")).toBe("{ not json");
  });

  it("patches a valid file atomically", async () => {
    const updated = await store.patchConfig({ meta: { ...defaultConfig.meta, name: "Neu" } });
    expect(updated.meta.name).toBe("Neu");
    expect(JSON.parse(readFileSync(file, "utf8")).meta.name).toBe("Neu");
    expect(existsSync(`${file}.tmp`)).toBe(false);
  });
});
