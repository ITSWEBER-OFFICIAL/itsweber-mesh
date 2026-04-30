import { useMemo } from "react";
import { trpc } from "@/lib/trpc-client";

export interface SearchResult {
  id: string;
  kind: "service" | "board" | "quickLink" | "widget";
  title: string;
  subtitle?: string;
  url?: string;
  icon?: string;
}

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function matches(query: string, ...fields: (string | undefined)[]) {
  const q = norm(query);
  return fields.some((f) => f && norm(f).includes(q));
}

export function useLocalSearch(query: string): SearchResult[] {
  const { data: services = [] } = trpc.services.list.useQuery(undefined, { staleTime: 60_000 });
  const { data: boards = [] } = trpc.boards.list.useQuery(undefined, { staleTime: 60_000 });
  const { data: quickLinks = [] } = trpc.quickLinks.list.useQuery(undefined, { staleTime: 60_000 });

  return useMemo(() => {
    const q = query.trim();
    if (q.length < 1) return [];

    const results: SearchResult[] = [];

    for (const s of services) {
      if (matches(q, s.name, s.category, s.description)) {
        results.push({
          id: `service-${s.id}`,
          kind: "service",
          title: s.name,
          subtitle: s.category,
          url: s.url,
          icon: s.icon,
        });
      }
    }

    for (const b of boards) {
      if (matches(q, b.name, b.slug)) {
        results.push({
          id: `board-${b.id}`,
          kind: "board",
          title: b.name,
          subtitle: `/${b.slug}`,
          url: b.slug === "home" ? "/" : `/boards/${b.slug}`,
        });
      }
    }

    for (const ql of quickLinks) {
      if (matches(q, ql.label, ql.url)) {
        results.push({
          id: `ql-${ql.id}`,
          kind: "quickLink",
          title: ql.label,
          url: ql.url,
          icon: ql.iconEmoji,
        });
      }
    }

    return results.slice(0, 8);
  }, [query, services, boards, quickLinks]);
}
