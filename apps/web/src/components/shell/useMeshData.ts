"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc-client";
import { buildOverview, healthOf, type Health } from "@/lib/service-view";
import type { Service } from "@/server/config/schema";

const NO_SERVICES: Service[] = [];

/** Shared data for shell, Start, Dienste and Hinweise. React Query dedupes the requests. */
export function useMeshData() {
  const { data: services = NO_SERVICES, isLoading } = trpc.services.list.useQuery(undefined, { staleTime: 30_000 });
  const { data: pings } = trpc.status.all.useQuery(undefined, { refetchInterval: 15_000 });
  const { data: network } = trpc.status.network.useQuery(undefined, { staleTime: 60_000 });

  return useMemo(() => {
    const map = pings ?? {};
    const enabled = services.filter((s) => s.enabled);
    const health = (s: Service): Health => healthOf(s, map[s.id]);
    return {
      loading: isLoading,
      services: enabled,
      pings: map,
      internal: network?.internal ?? true,
      health,
      down: enabled.filter((s) => health(s) === "bad"),
      overview: buildOverview(services, map),
    };
  }, [services, pings, network, isLoading]);
}
