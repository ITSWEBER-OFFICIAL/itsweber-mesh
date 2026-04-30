import { NextResponse } from "next/server";
import { readConfig } from "@/server/config/store";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";

export type CameraListData = {
  cameras: {
    id: string;
    label: string;
    snapshotUrl: string;
    linkUrl?: string;
    refreshSec: number;
  }[];
};

/** GET /api/widgets/cameras — liefert die Liste aktiver Kameras */
export async function GET(req: Request) {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const cfg = readConfig();
  const cameras = cfg.cameras
    .filter((c) => c.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => {
      const entry: CameraListData["cameras"][number] = {
        id: c.id,
        label: c.label,
        snapshotUrl: c.snapshotUrl,
        refreshSec: c.refreshSec,
      };
      if (c.linkUrl) entry.linkUrl = c.linkUrl;
      return entry;
    });

  return NextResponse.json({ cameras } satisfies CameraListData);
}
