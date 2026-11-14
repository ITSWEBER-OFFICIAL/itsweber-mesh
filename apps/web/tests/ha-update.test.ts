import { describe, it, expect } from "vitest";
import { runHaUpdate, haApi, type HaApi } from "@/server/ha-update";

const states = [
  { entity_id: "update.zigbee2mqtt_update", state: "on", attributes: { title: "Zigbee2MQTT", installed_version: "2.6.1", latest_version: "2.6.3" } },
  { entity_id: "update.esp_flur", state: "off", attributes: { friendly_name: "ESP Flur Update" } },
];

function api(install: HaApi["install"], calls: string[] = []): HaApi {
  return {
    states: async () => states,
    install: (id, t) => {
      calls.push(id);
      return install(id, t);
    },
  };
}

describe("Home Assistant update", () => {
  it("refuses anything that is not a plain update entity", async () => {
    const calls: string[] = [];
    const a = api(async () => {}, calls);
    expect((await runHaUpdate(a, "switch.heizung")).result).toBe("refused");
    expect((await runHaUpdate(a, 'update.x", "entity_id": "all')).result).toBe("refused");
    expect((await runHaUpdate(a, "update.gibt_es_nicht")).result).toBe("refused");
    expect(calls).toEqual([]);
  });

  it("refuses an entity without a pending update", async () => {
    const calls: string[] = [];
    const out = await runHaUpdate(api(async () => {}, calls), "update.esp_flur");
    expect(out).toEqual({ result: "refused", name: "ESP Flur", detail: "Für ESP Flur steht kein Update an" });
    expect(calls).toEqual([]);
  });

  it("installs a pending update exactly once", async () => {
    const calls: string[] = [];
    expect(await runHaUpdate(api(async () => {}, calls), "update.zigbee2mqtt_update")).toEqual({ result: "ok", name: "Zigbee2MQTT" });
    expect(calls).toEqual(["update.zigbee2mqtt_update"]);
  });

  it("reports a long update as started and the real end later", async () => {
    let fail: (e: Error) => void = () => {};
    const out = await runHaUpdate(api(() => new Promise<void>((_, reject) => { fail = reject; })), "update.zigbee2mqtt_update", 20);
    expect(out).toMatchObject({ result: "ok", detail: "Update läuft noch" });
    fail(new Error("socket hang up"));
    expect(await out.pending).toEqual({ result: "failed", name: "Zigbee2MQTT", detail: "socket hang up" });
  });

  it("does not install when Home Assistant cannot be read", async () => {
    const calls: string[] = [];
    const a: HaApi = { states: async () => { throw new Error("offline"); }, install: async (id) => { calls.push(id); } };
    expect(await runHaUpdate(a, "update.zigbee2mqtt_update")).toMatchObject({ result: "failed", detail: "offline" });
    expect(calls).toEqual([]);
  });

  it("calls the install service with the token and only the entity id", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const doFetch = (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return new Response("[]", { status: 200 });
    }) as unknown as typeof fetch;
    await haApi("http://ha.example.net:8123/", "tok", doFetch).install("update.zigbee2mqtt_update", 1000);
    expect(seen[0]?.url).toBe("http://ha.example.net:8123/api/services/update/install");
    expect(seen[0]?.init.body).toBe('{"entity_id":"update.zigbee2mqtt_update"}');
    expect((seen[0]?.init.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok");
  });
});
