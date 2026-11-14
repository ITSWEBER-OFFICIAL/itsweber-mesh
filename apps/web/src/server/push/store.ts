/* Zustand für Push in /data/push.json: Schlüsselpaar, Abos der Geräte und die
   bereits gemeldeten dringenden Hinweise. Bewusst nicht in config.json, damit ein
   Abo keinen Schema-Sprung braucht und die Sicherung der Config kein Schlüsselpaar trägt. */
import fs from "node:fs";
import path from "node:path";
import { generateVapid, type PushSubscription, type VapidJwk } from "./webpush";

export type StoredSubscription = PushSubscription & { user: string; createdAt: string };

export type PushState = {
  vapid: VapidJwk;
  subs: StoredSubscription[];
  /** Ids of urgent items that were already reported. null until the first run. */
  known: string[] | null;
};

const MAX_SUBS = 20;

function file(): string {
  return path.join(process.env["DATA_DIR"] ?? "/data", "push.json");
}

function write(state: PushState): void {
  const f = file();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, f);
}

export function readPushState(): PushState {
  try {
    const raw = JSON.parse(fs.readFileSync(file(), "utf8")) as Partial<PushState>;
    if (raw.vapid?.d && raw.vapid.x && raw.vapid.y) {
      return { vapid: raw.vapid, subs: Array.isArray(raw.subs) ? raw.subs : [], known: Array.isArray(raw.known) ? raw.known : null };
    }
  } catch {
    // no file yet or unreadable: start fresh below
  }
  const fresh: PushState = { vapid: generateVapid(), subs: [], known: null };
  write(fresh);
  return fresh;
}

export function addSubscription(sub: PushSubscription, user: string, now: Date = new Date()): void {
  const state = readPushState();
  const rest = state.subs.filter((s) => s.endpoint !== sub.endpoint);
  // Newest last. The oldest fall out once the limit is reached.
  const subs = [...rest, { ...sub, user, createdAt: now.toISOString() }].slice(-MAX_SUBS);
  write({ ...state, subs });
}

export function removeSubscription(endpoint: string): boolean {
  const state = readPushState();
  const subs = state.subs.filter((s) => s.endpoint !== endpoint);
  if (subs.length === state.subs.length) return false;
  write({ ...state, subs });
  return true;
}

export function setKnown(known: string[]): void {
  write({ ...readPushState(), known });
}
