"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { ServiceGrid, type ServiceCategoryFilter } from "./ServiceGrid";

const CATEGORY_FILTERS: Array<{ id: ServiceCategoryFilter; label: string }> = [
  { id: "all",            label: "Alle" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "smart-home",     label: "Smart Home" },
  { id: "media",          label: "Media" },
  { id: "tools",          label: "Tools" },
  { id: "external",       label: "External" },
];

/* v17: Full services browser used on /services. Search + category filter
   bar, hit count, and the shared ServiceGrid (no pin filter). */
export function ServicesBrowser() {
  const [filter, setFilter] = useState<ServiceCategoryFilter>("all");
  const [query, setQuery] = useState("");

  const { data: services = [] } = trpc.services.list.useQuery();
  const trimmed = query.trim().toLowerCase();
  const matchCount = useMemo(
    () =>
      services
        .filter((s) => s.enabled)
        .filter((s) => filter === "all" || s.category === filter)
        .filter((s) => {
          if (!trimmed) return true;
          return `${s.name} ${s.url} ${s.description ?? ""}`.toLowerCase().includes(trimmed);
        }).length,
    [services, filter, trimmed],
  );

  return (
    <section className="services-browser">
      <div className="services-browser-head">
        <div>
          <div className="section-kicker">Service Launcher</div>
          <h1 className="services-browser-title">Alle Services im Überblick</h1>
          <p className="services-browser-sub">
            Status live aus dem Healthcheck-Scheduler. Filter und Suche kombinierbar.
          </p>
        </div>
      </div>

      <div className="services-browser-search">
        <Search size={17} className="services-browser-search-icon" />
        <input
          type="text"
          placeholder="Service, Domain oder Beschreibung filtern…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="services-browser-search-input"
        />
        <span className="services-browser-count">{matchCount} {matchCount === 1 ? "Treffer" : "Treffer"}</span>
      </div>

      <div className="filter-bar filter-bar-block" role="tablist" aria-label="Service-Kategorie filtern">
        {CATEGORY_FILTERS.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={filter === cat.id}
            className={`filter-bar-btn ${filter === cat.id ? "filter-bar-btn-active" : ""}`}
            onClick={() => setFilter(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <ServiceGrid categoryFilter={filter} searchQuery={query} />
    </section>
  );
}
