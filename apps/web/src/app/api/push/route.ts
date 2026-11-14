import { NextResponse } from "next/server";
import { readConfig } from "@/server/config/store";
import { getStrategy, parseCookies } from "@/server/auth";
import { addSubscription, readPushState, removeSubscription } from "@/server/push/store";
import { parseSubscription, publicKeyOf, sendPush } from "@/server/push/webpush";
import { PUSH_SUBJECT } from "@/server/push/notifier";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

async function userOf(req: Request): Promise<string | null> {
  const result = await getStrategy(readConfig().auth).verify(req, parseCookies(req.headers.get("cookie")));
  return result.ok ? result.user.name : null;
}

/** Public key and how many devices are subscribed. */
export async function GET(req: Request) {
  if (!(await userOf(req))) return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });
  const state = readPushState();
  return NextResponse.json({ ok: true, publicKey: publicKeyOf(state.vapid), devices: state.subs.length }, { headers: NO_STORE });
}

/** body: { action: "subscribe" | "unsubscribe" | "test", subscription } */
export async function POST(req: Request) {
  const user = await userOf(req);
  if (!user) return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });

  let body: { action?: unknown; subscription?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage" }, { status: 400, headers: NO_STORE });
  }
  const sub = parseSubscription(body.subscription);
  if (!sub) return NextResponse.json({ ok: false, error: "Dieses Abo wird nicht unterstützt" }, { status: 400, headers: NO_STORE });

  if (body.action === "subscribe") {
    addSubscription(sub, user);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }
  if (body.action === "unsubscribe") {
    removeSubscription(sub.endpoint);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }
  if (body.action === "test") {
    const state = readPushState();
    // Only to a device that is subscribed, never to an address from the request alone.
    const known = state.subs.find((s) => s.endpoint === sub.endpoint);
    if (!known) return NextResponse.json({ ok: false, error: "Dieses Gerät ist nicht angemeldet" }, { status: 409, headers: NO_STORE });
    const result = await sendPush(state.vapid, known, { title: "Mesh", body: "Testmeldung. So kommen dringende Hinweise an.", url: "/hinweise", tag: "mesh-test" }, PUSH_SUBJECT);
    if (result === "gone") removeSubscription(known.endpoint);
    return NextResponse.json({ ok: result === "sent", result }, { status: result === "sent" ? 200 : 502, headers: NO_STORE });
  }
  return NextResponse.json({ ok: false, error: "Unbekannte Aktion" }, { status: 400, headers: NO_STORE });
}
