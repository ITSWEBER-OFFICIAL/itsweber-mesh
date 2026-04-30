"use client";

import { usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc-client";

/**
 * Resolves the currently visible board id from the route:
 * - `/`              → home board
 * - `/boards/<slug>` → board with that slug, falls back to home if unknown
 * - any other route  → home board (best-effort default)
 *
 * Returns `undefined` while the boards query is still loading or empty.
 */
export function useCurrentBoardId(): string | undefined {
  const pathname = usePathname();
  const { data: boards } = trpc.boards.list.useQuery(undefined, { staleTime: 30_000 });
  if (!boards || boards.length === 0) return undefined;

  if (pathname.startsWith("/boards/")) {
    const slug = pathname.split("/")[2];
    const match = boards.find((b) => b.slug === slug);
    if (match) return match.id;
  }
  const home = boards.find((b) => b.isHome);
  return home?.id ?? boards[0]?.id;
}
