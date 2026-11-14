import { NextResponse } from "next/server";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";
import { collectHints, type HintsResult } from "@/server/hints/collect";

export type { HintsResult } from "@/server/hints/collect";
export type { Hint } from "@/server/hints/build";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* Several open tabs and the installed app poll this at once. One collection
   per 30 seconds is shared between them. */
const TTL_MS = 30_000;
let cached: { at: number; result: Promise<HintsResult> } | null = null;

export async function GET(req: Request) {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const now = Date.now();
  if (!cached || now - cached.at > TTL_MS) {
    cached = { at: now, result: collectHints(readConfig(), now) };
  }
  try {
    return NextResponse.json(await cached.result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    cached = null;
    return NextResponse.json({ hints: [], sources: [], certs: [], checkedAt: now } satisfies HintsResult, { status: 500 });
  }
}
