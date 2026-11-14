/* Web Push ohne Fremdpaket. RFC 8291 für die Verschlüsselung (aes128gcm),
   RFC 8292 für VAPID. Vorlage ist status-api/src/push.js im Gameserver-Projekt. */
import { createECDH, createCipheriv, createPrivateKey, generateKeyPairSync, hkdfSync, randomBytes, sign } from "node:crypto";

export type VapidJwk = { kty: string; crv: string; x: string; y: string; d: string };
export type PushSubscription = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; url: string; tag?: string };

const b64 = (b: Buffer | string): string => Buffer.from(b).toString("base64url");

/** Only the known push services. Otherwise a subscription could aim Mesh at any address. */
const SERVICES = /^https:\/\/([a-z0-9-]+\.)*(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)\//i;

export function generateVapid(): VapidJwk {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return privateKey.export({ format: "jwk" }) as VapidJwk;
}

/** Uncompressed public key, the value the browser needs as applicationServerKey. */
export function publicKeyOf(jwk: VapidJwk): string {
  return b64(Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]));
}

export function parseSubscription(body: unknown): PushSubscription | null {
  const b = (body && typeof body === "object" ? body : {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = typeof b.endpoint === "string" ? b.endpoint : "";
  const p256dh = typeof b.keys?.p256dh === "string" ? b.keys.p256dh : "";
  const auth = typeof b.keys?.auth === "string" ? b.keys.auth : "";
  if (endpoint.length > 600 || !SERVICES.test(endpoint)) return null;
  if (!/^[\w-]{80,100}$/.test(p256dh) || !/^[\w-]{16,32}$/.test(auth)) return null;
  return { endpoint, p256dh, auth };
}

export function encrypt(text: string, p256dh: string, auth: string): Buffer {
  const receiver = Buffer.from(p256dh, "base64url");
  const secret = Buffer.from(auth, "base64url");
  const ecdh = createECDH("prime256v1");
  const sender = ecdh.generateKeys();
  const salt = randomBytes(16);
  const hkdf = (ikm: Buffer, s: Buffer, info: Buffer, n: number) => Buffer.from(hkdfSync("sha256", ikm, s, info, n));
  const ikm = hkdf(ecdh.computeSecret(receiver), secret, Buffer.concat([Buffer.from("WebPush: info\0"), receiver, sender]), 32);
  const cek = hkdf(ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12);
  const c = createCipheriv("aes-128-gcm", cek, nonce);
  const content = Buffer.concat([c.update(Buffer.concat([Buffer.from(text), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([sender.length]), sender, content]);
}

export function vapidHeader(jwk: VapidJwk, endpoint: string, subject: string, now: number = Date.now()): string {
  const head = b64(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const data = b64(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 43_200, sub: subject }));
  const signature = sign("sha256", Buffer.from(`${head}.${data}`), { key: createPrivateKey({ key: jwk, format: "jwk" }), dsaEncoding: "ieee-p1363" });
  return `vapid t=${head}.${data}.${b64(signature)}, k=${publicKeyOf(jwk)}`;
}

export type SendResult = "sent" | "gone" | "failed";

/** One message to one subscription. "gone" means the subscription no longer exists and can be dropped. */
export async function sendPush(
  jwk: VapidJwk,
  sub: PushSubscription,
  payload: PushPayload,
  subject: string,
  doFetch: typeof fetch = fetch,
): Promise<SendResult> {
  const body = JSON.stringify({ ...payload, body: payload.body.slice(0, 180) });
  try {
    const res = await doFetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidHeader(jwk, sub.endpoint, subject),
        TTL: "86400",
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        Urgency: "high",
      },
      body: new Uint8Array(encrypt(body, sub.p256dh, sub.auth)),
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404 || res.status === 410) return "gone";
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
