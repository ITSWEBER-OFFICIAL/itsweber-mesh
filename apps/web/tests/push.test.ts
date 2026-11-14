import { describe, it, expect, beforeEach } from "vitest";
import { createDecipheriv, createECDH, createPublicKey, hkdfSync, randomBytes, verify } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { encrypt, generateVapid, parseSubscription, publicKeyOf, sendPush, vapidHeader } from "@/server/push/webpush";
import { planPush, downServices, DOWN_GRACE_MS } from "@/server/push/notifier";
import { addSubscription, readPushState, removeSubscription, setKnown } from "@/server/push/store";

/** A browser's side of RFC 8291, to prove that what Mesh sends can be read. */
function receiver() {
  const ecdh = createECDH("prime256v1");
  const pub = ecdh.generateKeys();
  const auth = randomBytes(16);
  const decrypt = (msg: Buffer): string => {
    const salt = msg.subarray(0, 16);
    const idLen = msg.readUInt8(20);
    const sender = msg.subarray(21, 21 + idLen);
    const content = msg.subarray(21 + idLen);
    const hkdf = (ikm: Buffer, s: Buffer, info: Buffer, n: number) => Buffer.from(hkdfSync("sha256", ikm, s, info, n));
    const ikm = hkdf(ecdh.computeSecret(sender), auth, Buffer.concat([Buffer.from("WebPush: info\0"), pub, sender]), 32);
    const cek = hkdf(ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
    const nonce = hkdf(ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12);
    const d = createDecipheriv("aes-128-gcm", cek, nonce);
    d.setAuthTag(content.subarray(content.length - 16));
    const plain = Buffer.concat([d.update(content.subarray(0, content.length - 16)), d.final()]);
    return plain.subarray(0, plain.lastIndexOf(2)).toString();
  };
  return { p256dh: pub.toString("base64url"), auth: auth.toString("base64url"), decrypt };
}

describe("web push", () => {
  it("encrypts so that the receiving browser can read it", () => {
    const r = receiver();
    const text = JSON.stringify({ title: "Mesh", body: "Zertifikat läuft ab", url: "/hinweise" });
    expect(r.decrypt(encrypt(text, r.p256dh, r.auth))).toBe(text);
  });

  it("signs a VAPID token that verifies with the public key", () => {
    const jwk = generateVapid();
    const header = vapidHeader(jwk, "https://web.push.apple.com/abc", "https://example.net", 1_800_000_000_000);
    const token = /t=([^,]+)/.exec(header)?.[1] ?? "";
    const [head, data, sig] = token.split(".");
    const key = createPublicKey({ key: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y }, format: "jwk" });
    expect(verify("sha256", Buffer.from(`${head}.${data}`), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(sig ?? "", "base64url"))).toBe(true);
    expect(JSON.parse(Buffer.from(data ?? "", "base64url").toString())).toMatchObject({ aud: "https://web.push.apple.com", sub: "https://example.net" });
    expect(header).toContain(`k=${publicKeyOf(jwk)}`);
    expect(Buffer.from(publicKeyOf(jwk), "base64url")).toHaveLength(65);
  });

  it("accepts only subscriptions of known push services", () => {
    const r = receiver();
    const keys = { p256dh: r.p256dh, auth: r.auth };
    expect(parseSubscription({ endpoint: "https://web.push.apple.com/QGk", keys })).not.toBeNull();
    expect(parseSubscription({ endpoint: "https://fcm.googleapis.com/fcm/send/x", keys })).not.toBeNull();
    expect(parseSubscription({ endpoint: "https://10.0.0.5/internal", keys })).toBeNull();
    expect(parseSubscription({ endpoint: "https://push.apple.com.evil.example/x", keys })).toBeNull();
    expect(parseSubscription({ endpoint: "http://web.push.apple.com/x", keys })).toBeNull();
    expect(parseSubscription({ endpoint: "https://web.push.apple.com/x", keys: { p256dh: "kurz", auth: r.auth } })).toBeNull();
    expect(parseSubscription(null)).toBeNull();
  });

  it("reports a dead subscription as gone and a server error as failed", async () => {
    const r = receiver();
    const sub = { endpoint: "https://web.push.apple.com/x", p256dh: r.p256dh, auth: r.auth };
    const jwk = generateVapid();
    const answer = (status: number) => (async () => new Response(null, { status })) as unknown as typeof fetch;
    const payload = { title: "t", body: "b", url: "/" };
    expect(await sendPush(jwk, sub, payload, "https://example.net", answer(201))).toBe("sent");
    expect(await sendPush(jwk, sub, payload, "https://example.net", answer(410))).toBe("gone");
    expect(await sendPush(jwk, sub, payload, "https://example.net", answer(500))).toBe("failed");
  });
});

describe("push plan", () => {
  const item = (id: string) => ({ id, title: `Titel ${id}`, body: "b", url: "/hinweise" });

  it("stays silent on the first run and remembers the current state", () => {
    expect(planPush([item("a"), item("b")], null)).toEqual({ messages: [], known: ["a", "b"] });
  });

  it("sends one message per new item and nothing for known ones", () => {
    const plan = planPush([item("a"), item("b")], ["a"]);
    expect(plan.messages.map((m) => m.tag)).toEqual(["b"]);
    expect(plan.known).toEqual(["a", "b"]);
    expect(planPush([item("a"), item("b")], ["a", "b"]).messages).toEqual([]);
  });

  it("reports a problem again after it was resolved in between", () => {
    const resolved = planPush([], ["a"]);
    expect(resolved).toEqual({ messages: [], known: [] });
    expect(planPush([item("a")], resolved.known).messages).toHaveLength(1);
  });

  it("sends a single summary when many things break at once", () => {
    const plan = planPush(["a", "b", "c", "d", "e"].map(item), []);
    expect(plan.messages).toHaveLength(1);
    expect(plan.messages[0]?.title).toBe("5 neue dringende Hinweise");
  });
});

describe("down services for push", () => {
  const svc = (id: string, kind = "http") => ({ id, name: id, enabled: true, pingTarget: { kind } });

  it("waits for the grace period and forgets recovered services", () => {
    const since = new Map<string, number>();
    const services = [svc("a"), svc("b"), svc("c", "none")];
    const pings = { a: { status: "offline" }, b: { status: "online" }, c: { status: "offline" } };
    expect(downServices(services, pings, 1000, since)).toEqual([]);
    expect(downServices(services, pings, 1000 + DOWN_GRACE_MS, since).map((i) => i.id)).toEqual(["service:a"]);
    expect(downServices(services, { ...pings, a: { status: "online" } }, 2000 + DOWN_GRACE_MS, since)).toEqual([]);
    expect(since.size).toBe(0);
  });
});

describe("push store", () => {
  beforeEach(() => {
    process.env["DATA_DIR"] = fs.mkdtempSync(path.join(os.tmpdir(), "mesh-push-"));
  });

  it("creates a key pair once and keeps it", () => {
    const first = readPushState();
    expect(first.known).toBeNull();
    expect(readPushState().vapid.d).toBe(first.vapid.d);
    const mode = fs.statSync(path.join(process.env["DATA_DIR"] as string, "push.json")).mode;
    expect(mode & 0o400).toBeTruthy();
  });

  it("adds a device once, removes it and stores what was reported", () => {
    const sub = { endpoint: "https://web.push.apple.com/x", p256dh: "p", auth: "a" };
    addSubscription(sub, "user");
    addSubscription(sub, "user");
    expect(readPushState().subs).toHaveLength(1);
    setKnown(["service:1"]);
    expect(readPushState().known).toEqual(["service:1"]);
    expect(removeSubscription(sub.endpoint)).toBe(true);
    expect(removeSubscription(sub.endpoint)).toBe(false);
    expect(readPushState().subs).toEqual([]);
  });
});
