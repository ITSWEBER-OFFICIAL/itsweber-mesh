"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";
import { CATEGORY_LABEL, CATEGORY_ORDER, PROTECTION_TAG, hostOf, pickUrl } from "@/lib/service-view";
import { ServiceCategorySchema, type Service, type ServiceCategory } from "@/server/config/schema";
import { Screen, Dot, Icon } from "./AppShell";
import { downReason } from "./DownList";
import { useMeshData } from "./useMeshData";

type Filter = "all" | ServiceCategory;

export function DiensteView() {
  const { overview, services, pings, internal, health, loading } = useMeshData();
  const params = useSearchParams();
  const initial = ServiceCategorySchema.safeParse(params?.get("cat"));
  const [filter, setFilter] = useState<Filter>(initial.success ? initial.data : "all");
  const [query, setQuery] = useState("");

  const utils = trpc.useUtils();
  const toast = useToast();
  const ping = trpc.status.ping.useMutation({
    onSuccess: (res, vars) => {
      utils.status.all.invalidate();
      const name = services.find((s) => s.id === vars.id)?.name ?? "Dienst";
      if (res.status === "online") toast.success(`${name} läuft wieder`);
      else toast.error(`${name} antwortet weiter nicht`, downReason(res));
    },
    onError: (e) => toast.error("Prüfung fehlgeschlagen", e.message),
  });

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      services
        .filter((s) => filter === "all" || s.category === filter)
        .filter((s) => !q || `${s.name} ${s.url} ${s.urlExternal ?? ""} ${s.description ?? ""}`.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name, "de")),
    [services, filter, q],
  );
  const down = visible.filter((s) => health(s) === "bad");
  const groups = CATEGORY_ORDER.map((c) => ({
    category: c,
    list: visible.filter((s) => s.category === c && health(s) !== "bad"),
  })).filter((g) => g.list.length > 0);

  const row = (s: Service, isDown: boolean) => {
    const link = pickUrl(s, internal);
    const tag = link.homeOnly ? "NUR ZUHAUSE" : PROTECTION_TAG[s.protection];
    return (
      <div className="m-row" key={s.id}>
        <a className="m-row-link" href={link.href} target="_blank" rel="noopener noreferrer">
          <Dot state={health(s)} />
          <span>
            <b>{s.name}</b>
            <small>{isDown ? downReason(pings[s.id]) : hostOf(link.href)}</small>
          </span>
        </a>
        {isDown ? (
          <button
            type="button"
            className="m-btn"
            disabled={ping.isPending && ping.variables?.id === s.id}
            onClick={() => ping.mutate({ id: s.id })}
          >
            {ping.isPending && ping.variables?.id === s.id ? "Prüft" : "Prüfen"}
          </button>
        ) : (
          tag && <span className="m-tag">{tag}</span>
        )}
      </div>
    );
  };

  return (
    <Screen
      title="Dienste"
      small
      context={loading ? undefined : `${overview.ok} von ${overview.total} laufen`}
      kanzel={
        <>
          <label className="m-search">
            <Icon name="suche" />
            <span className="m-sr">Dienst suchen</span>
            <input
              type="search"
              placeholder="Dienst suchen"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
            />
          </label>
          <div className="m-chips" role="group" aria-label="Bereich filtern">
            <button type="button" className="m-chip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
              <span>Alle {overview.total}</span>
            </button>
            {overview.segments.map((seg) => (
              <button
                key={seg.category}
                type="button"
                className="m-chip"
                aria-pressed={filter === seg.category}
                onClick={() => setFilter(seg.category)}
              >
                <span>
                  {seg.label} {seg.total}
                </span>
              </button>
            ))}
          </div>
        </>
      }
    >
      {down.length > 0 && (
        <section className="m-sec">
          <h2 className="m-h">Antwortet nicht · {down.length}</h2>
          {down.map((s) => row(s, true))}
        </section>
      )}
      {groups.map((g) => (
        <section className="m-sec" key={g.category}>
          <h2 className="m-h">
            {CATEGORY_LABEL[g.category]} · {g.list.length}
          </h2>
          {g.list.map((s) => row(s, false))}
        </section>
      ))}
      {!loading && visible.length === 0 && (
        <p className="m-note">{services.length === 0 ? "Noch keine Dienste angelegt." : "Kein Dienst passt zur Suche."}</p>
      )}
    </Screen>
  );
}
