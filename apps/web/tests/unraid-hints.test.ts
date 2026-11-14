import { describe, it, expect } from "vitest";
import { unraidHints, unraidDetailHints } from "@/server/hints/build";
import { parseDisks, parseContainers, parseVms, parseNotices } from "@/server/unraid/detail";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 14, 12);

describe("Unraid hints", () => {
  it("reports an unreachable server and a stopped array as urgent", () => {
    const hints = unraidHints([
      { id: "1", label: "Core", online: false },
      { id: "2", label: "Node", online: true, data: { array: { state: "STOPPED" } } },
      { id: "3", label: "Drei", online: true, data: { array: { state: "STARTED" } } },
    ]);
    expect(hints.map((h) => [h.kind, h.level])).toEqual([["server", "urgent"], ["array", "urgent"]]);
  });

  const base = { id: "1", label: "Core", disks: null, containers: null, notices: null };
  const disk = (over = {}) => ({ name: "disk1", role: "data" as const, status: "DISK_OK", ok: true, tempC: 30, errors: 0, usedPercent: 50, ...over });

  it("counts only stopped containers that should autostart", () => {
    const hints = unraidDetailHints(
      [
        {
          ...base,
          containers: [
            { name: "a", running: false, autoStart: true },
            { name: "b", running: false, autoStart: false },
            { name: "c", running: true, autoStart: true },
          ],
        },
      ],
      NOW,
    );
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({ level: "watch", title: "1 Container auf Core steht trotz Autostart", detail: "a" });
  });

  it("reports disk state, errors, temperature and fill level", () => {
    const hints = unraidDetailHints(
      [
        {
          ...base,
          disks: [
            disk(),
            disk({ name: "disk2", status: "DISK_DSBL", ok: false, errors: 12 }),
            disk({ name: "disk3", errors: 3 }),
            disk({ name: "disk4", tempC: 47 }),
            disk({ name: "disk5", tempC: 56 }),
            disk({ name: "cache", role: "cache" as const, tempC: 52, usedPercent: 93 }),
          ],
        },
      ],
      NOW,
    );
    expect(hints.map((h) => [h.id.split(":").slice(2).join(":"), h.level])).toEqual([
      ["disk2:status", "urgent"],
      ["disk3:errors", "watch"],
      ["disk4:temp", "watch"],
      ["disk5:temp", "urgent"],
      ["cache:full", "watch"],
    ]);
  });

  it("shows recent Unraid alerts as urgent, warnings as watch and drops old ones", () => {
    const at = (days: number) => new Date(NOW - days * DAY).toISOString();
    const hints = unraidDetailHints(
      [
        {
          ...base,
          notices: [
            { id: "a", level: "alert" as const, title: "Unraid Status", subject: "Sicherung", description: "rsync fehlgeschlagen", timestamp: at(3) },
            { id: "b", level: "warning" as const, title: "Parity", subject: "Parity-Check started", description: "", timestamp: at(1) },
            { id: "c", level: "alert" as const, title: "Alt", subject: "Alt", description: "", timestamp: at(9) },
          ],
        },
      ],
      NOW,
    );
    expect(hints.map((h) => [h.id, h.level])).toEqual([["notice:a", "urgent"], ["notice:b", "watch"]]);
    expect(hints[0]?.title).toBe("Core: Sicherung");
  });
});

describe("Unraid detail parsing", () => {
  it("maps disks with role, size and fill level and skips empty slots", () => {
    const raw = JSON.stringify({
      data: {
        array: {
          parities: [{ name: "parity", device: "sdb", size: 11718885324, status: "DISK_OK", temp: 31, numErrors: 0, isSpinning: true }],
          disks: [
            { name: "disk1", device: "sdf", size: 5860522532, status: "DISK_OK", temp: null, numErrors: "2", fsSize: 1000, fsUsed: 250, isSpinning: false },
            { name: "disk2", status: "DISK_NP" },
          ],
          caches: [{ name: "cache", device: "nvme0n1", size: 937691480, status: "DISK_OK", temp: 32, numErrors: 0, fsSize: 100, fsUsed: 47 }],
        },
      },
    });
    const disks = parseDisks(raw);
    expect(disks?.map((d) => [d.name, d.role])).toEqual([["parity", "parity"], ["disk1", "data"], ["cache", "cache"]]);
    expect(disks?.[0]?.sizeTb).toBe(10.9);
    expect(disks?.[1]).toMatchObject({ errors: 2, usedPercent: 25, tempC: null, spinning: false });
  });

  it("maps containers, VMs and notices", () => {
    const containers = parseContainers(
      JSON.stringify({ data: { docker: { containers: [
        { id: "x:2", names: ["/zeta"], state: "EXITED", status: "Exited (0)", autoStart: true },
        { id: "x:1", names: ["/Alpha"], state: "RUNNING", status: "Up", autoStart: false },
      ] } } }),
    );
    expect(containers?.map((c) => [c.name, c.running, c.autoStart])).toEqual([["Alpha", true, false], ["zeta", false, true]]);

    const vms = parseVms(JSON.stringify({ data: { vms: { domain: [{ id: "v1", name: "Windows", state: "SHUTOFF" }] } } }));
    expect(vms).toEqual([{ id: "v1", name: "Windows", state: "SHUTOFF", running: false }]);

    const notices = parseNotices(
      JSON.stringify({ data: { notifications: { warningsAndAlerts: [
        { id: "n1", title: "T", subject: "S", description: "D", importance: "ALERT", timestamp: "2026-11-11T03:35:51.000Z" },
        { id: "n2", title: "T", subject: "S", description: "D", importance: "INFO" },
      ] } } }),
    );
    expect(notices).toHaveLength(1);
    expect(notices?.[0]?.level).toBe("alert");
  });

  it("returns null for an error answer instead of an empty list", () => {
    expect(parseDisks(JSON.stringify({ errors: [{ message: "nope" }] }))).toBeNull();
    expect(parseContainers("kein json")).toBeNull();
  });
});
