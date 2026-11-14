import { describe, it, expect } from "vitest";
import { certHints, certHosts, haUpdateHints, unraidHints, sortHints, type Hint } from "@/server/hints/build";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 14, 12);

describe("certificate hints", () => {
  it("stays silent for certificates with enough time left", () => {
    expect(certHints([{ host: "a.example.com", ok: true, validTo: NOW + 60 * DAY }], NOW)).toEqual([]);
  });

  it("puts a certificate that expires within three weeks under watch", () => {
    const [h] = certHints([{ host: "a.example.com", ok: true, validTo: NOW + 10 * DAY }], NOW);
    expect(h?.level).toBe("watch");
    expect(h?.detail).toContain("In 10 Tagen");
  });

  it("makes a certificate urgent shortly before and after expiry", () => {
    const soon = certHints([{ host: "a.example.com", ok: true, validTo: NOW + DAY + 1000 }], NOW)[0];
    const gone = certHints([{ host: "b.example.com", ok: true, validTo: NOW - DAY }], NOW)[0];
    expect(soon?.level).toBe("urgent");
    expect(gone?.level).toBe("urgent");
    expect(gone?.title).toContain("abgelaufen");
  });

  it("does not report hosts that could not be probed", () => {
    expect(certHints([{ host: "a.example.com", ok: false, error: "timeout" }], NOW)).toEqual([]);
  });

  it("collects distinct https host names and skips IPs, http and local names", () => {
    expect(
      certHosts([
        "https://b.example.com/x",
        "https://a.example.com",
        "https://a.example.com/other",
        "http://c.example.com",
        "https://192.0.2.10:8443",
        "https://nas.local",
        "https://d.example.com:8443",
        undefined,
        "kein-url",
      ]),
    ).toEqual(["a.example.com", "b.example.com", "d.example.com:8443"]);
  });
});

describe("Home Assistant update hints", () => {
  const entity = (id: string, state: string, attributes = {}) => ({ entity_id: id, state, attributes });

  it("lists pending updates with both versions", () => {
    const hints = haUpdateHints([
      entity("update.home_assistant_core_update", "on", { title: "Home Assistant Core", installed_version: "2026.10.4", latest_version: "2026.11.1" }),
      entity("update.zigbee2mqtt_update", "off", { title: "Zigbee2MQTT" }),
      entity("sensor.something", "on"),
    ]);
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({ level: "watch", title: "Update für Home Assistant Core", detail: "2026.10.4 auf 2026.11.1" });
  });

  it("leaves out a version the user chose to skip", () => {
    const hints = haUpdateHints([
      entity("update.addon", "on", { friendly_name: "Addon Update", latest_version: "2", skipped_version: "2" }),
    ]);
    expect(hints).toEqual([]);
  });

  it("falls back to the friendly name without the word Update", () => {
    const [h] = haUpdateHints([entity("update.esp_flur", "on", { friendly_name: "ESP Flur Update", latest_version: "3" })]);
    expect(h?.title).toBe("Update für ESP Flur");
    expect(h?.detail).toBe("Version 3");
  });
});

describe("Unraid hints", () => {
  it("reports an unreachable server as urgent", () => {
    const [h] = unraidHints([{ id: "1", label: "Core", online: false }]);
    expect(h).toMatchObject({ level: "urgent", kind: "server" });
  });

  it("reports a stopped array as urgent and stopped containers as watch", () => {
    const hints = unraidHints([
      {
        id: "1",
        label: "Core",
        online: true,
        data: { array: { state: "STOPPED" }, containers: { running: 3, total: 9, stopped: ["a", "b", "c", "d", "e", "f"] } },
      },
    ]);
    expect(hints.map((h) => [h.kind, h.level])).toEqual([["array", "urgent"], ["container", "watch"]]);
    expect(hints[1]?.title).toBe("6 Container auf Core gestoppt");
    expect(hints[1]?.detail).toBe("a, b, c, d und 2 weitere");
  });

  it("stays silent when everything runs", () => {
    expect(
      unraidHints([{ id: "1", label: "Node", online: true, data: { array: { state: "STARTED" }, containers: { running: 4, total: 4, stopped: [] } } }]),
    ).toEqual([]);
  });
});

describe("hint order", () => {
  it("puts urgent before watch", () => {
    const h = (id: string, level: Hint["level"], kind: Hint["kind"]): Hint => ({ id, level, kind, title: id, detail: "" });
    expect(sortHints([h("u", "watch", "update"), h("c", "urgent", "cert"), h("s", "urgent", "server")]).map((x) => x.id)).toEqual(["s", "c", "u"]);
  });
});
