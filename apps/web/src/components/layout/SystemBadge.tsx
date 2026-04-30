"use client";

import { trpc } from "@/lib/trpc-client";

type BadgeState = "loading" | "ok" | "offline" | "empty";

export function SystemBadge() {
  const { data: statusMap, isLoading } = trpc.status.all.useQuery(undefined, {
    refetchInterval: 10_000,
  });

  const results = statusMap ? Object.values(statusMap) : [];
  const offline = results.filter((r) => r.status === "offline").length;

  let state: BadgeState;
  let label: string;
  if (isLoading || !statusMap) {
    state = "loading";
    label = "PRÜFE…";
  } else if (results.length === 0) {
    state = "empty";
    label = "KEINE PRÜFUNGEN";
  } else if (offline === 0) {
    state = "ok";
    label = "ALLE SYSTEME OK";
  } else {
    state = "offline";
    label = `${offline} OFFLINE`;
  }

  return (
    <div className="system-badge" data-state={state}>
      <span className="system-badge-dot" aria-hidden="true" />
      {label}
    </div>
  );
}
