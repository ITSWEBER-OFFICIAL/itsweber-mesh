/* Meldet neue dringende Hinweise per Push. Dringend ist, was auch in der App
   unter „Dringend“ steht: Dienste, die nicht antworten, und dringende Hinweise
   (Server, Array, Platten, Zertifikate, Alarme von Unraid). Updates und alles
   andere unter „Im Blick“ lösen nie einen Push aus. */
import { readConfig } from "../config/store";
import { getPingResults } from "../healthcheck/scheduler";
import { collectHints } from "../hints/collect";
import { logger } from "../logger";
import { readPushState, removeSubscription, setKnown } from "./store";
import { sendPush, type PushPayload } from "./webpush";

export type UrgentItem = { id: string; title: string; body: string; url: string };

/** A service must be down this long before it is reported, so a restart or a
 *  single lost ping does not wake anyone. */
export const DOWN_GRACE_MS = 3 * 60 * 1000;
const MAX_SINGLE = 3;

export const PUSH_SUBJECT = "https://github.com/ITSWEBER-OFFICIAL/itsweber-mesh";

export type Plan = { messages: PushPayload[]; known: string[] };

/** Decides what to send. Pure: `known` is what was reported before (null on the
 *  very first run, where the current state is taken as known without a message). */
export function planPush(current: UrgentItem[], known: string[] | null): Plan {
  const ids = current.map((i) => i.id);
  if (known === null) return { messages: [], known: ids };
  const fresh = current.filter((i) => !known.includes(i.id));
  // Resolved items leave `known`, so a problem that returns is reported again.
  if (fresh.length === 0) return { messages: [], known: ids };
  if (fresh.length <= MAX_SINGLE) {
    return { messages: fresh.map((i) => ({ title: i.title, body: i.body, url: i.url, tag: i.id })), known: ids };
  }
  return {
    messages: [
      {
        title: `${fresh.length} neue dringende Hinweise`,
        body: fresh.slice(0, 4).map((i) => i.title).join(", ") + (fresh.length > 4 ? " und weitere" : ""),
        url: "/hinweise",
        tag: "mesh-summary",
      },
    ],
    known: ids,
  };
}

const downSince = new Map<string, number>();

/** Services that have been down longer than the grace period. */
export function downServices(
  services: { id: string; name: string; enabled: boolean; pingTarget: { kind: string } }[],
  pings: Record<string, { status: string } | undefined>,
  now: number,
  since: Map<string, number> = downSince,
): UrgentItem[] {
  const out: UrgentItem[] = [];
  const seen = new Set<string>();
  for (const s of services) {
    if (!s.enabled || s.pingTarget.kind === "none") continue;
    if (pings[s.id]?.status !== "offline") continue;
    seen.add(s.id);
    const start = since.get(s.id) ?? now;
    since.set(s.id, start);
    if (now - start >= DOWN_GRACE_MS) {
      out.push({ id: `service:${s.id}`, title: `${s.name} antwortet nicht`, body: "Der Dienst ist seit einigen Minuten nicht erreichbar", url: "/hinweise" });
    }
  }
  for (const id of [...since.keys()]) if (!seen.has(id)) since.delete(id);
  return out;
}

let running = false;

export async function runPushSweep(now: number = Date.now()): Promise<void> {
  if (running) return;
  running = true;
  try {
    const cfg = readConfig();
    const state = readPushState();
    // Without a subscription nothing is collected, but downtime is still tracked
    // so the grace period is right once someone subscribes.
    const down = downServices(cfg.services, getPingResults(), now);
    if (state.subs.length === 0) return;

    const hints = await collectHints(cfg, now);
    const urgent: UrgentItem[] = [
      ...down,
      ...hints.hints.filter((h) => h.level === "urgent").map((h) => ({ id: `hint:${h.id}`, title: h.title, body: h.detail, url: "/hinweise" })),
    ];
    const plan = planPush(urgent, state.known);
    for (const message of plan.messages) {
      for (const sub of state.subs) {
        const result = await sendPush(state.vapid, sub, message, PUSH_SUBJECT);
        if (result === "gone") removeSubscription(sub.endpoint);
        if (result === "failed") logger.warn({ tag: message.tag }, "Push not delivered");
      }
    }
    const changed = state.known === null || plan.known.length !== state.known.length || plan.known.some((id) => !state.known?.includes(id));
    if (changed) setKnown(plan.known);
  } catch (err) {
    logger.error({ err }, "Push sweep failed");
  } finally {
    running = false;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __meshPushTimer: ReturnType<typeof setInterval> | undefined;
}

export function startPushNotifier(): void {
  if (globalThis.__meshPushTimer) return;
  globalThis.__meshPushTimer = setInterval(() => void runPushSweep(), 60_000);
  logger.info("Push notifier started (60s interval)");
}
