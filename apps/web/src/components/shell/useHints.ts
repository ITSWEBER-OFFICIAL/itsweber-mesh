"use client";

import { useQuery } from "@tanstack/react-query";
import type { Hint, HintsResult } from "@/app/api/hints/route";

const EMPTY: HintsResult = { hints: [], sources: [], checkedAt: 0 };
const NO_HINTS: Hint[] = [];

/** Hinweise aus Zertifikaten, Updates und Unraid. Dienste, die nicht antworten,
 *  kommen aus dem Healthcheck (useMeshData) und stehen nicht in dieser Liste. */
export function useHints() {
  const { data, isLoading, isError } = useQuery<HintsResult>({
    queryKey: ["mesh-hints"],
    queryFn: async () => {
      const res = await fetch("/api/hints", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as HintsResult;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const hints = data?.hints ?? NO_HINTS;
  return {
    loading: isLoading,
    failed: isError,
    urgent: hints.filter((h) => h.level === "urgent"),
    watch: hints.filter((h) => h.level === "watch"),
    notes: (data ?? EMPTY).sources.filter((s) => !s.ok && s.note).map((s) => s.note as string),
  };
}
