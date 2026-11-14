import { NextResponse } from "next/server";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";
import { loadUnraidDetail, type UnraidDetail } from "@/server/unraid/detail";

export type { UnraidDetail, UnraidDisk, UnraidContainer, UnraidVm, UnraidNotice } from "@/server/unraid/detail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const id = new URL(req.url).searchParams.get("id");
  const u = readConfig().integrations.unraid.find((x) => x.id === id);
  if (!u) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const detail: UnraidDetail = await loadUnraidDetail(u).catch(() => ({
    id: u.id,
    label: u.label,
    online: false,
    disks: null,
    containers: null,
    vms: null,
    notices: null,
  }));
  return NextResponse.json(detail, { headers: { "Cache-Control": "no-store" } });
}
