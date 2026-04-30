"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ServiceGrid, type ServiceCategoryFilter } from "./ServiceGrid";

const CATEGORY_FILTERS: Array<{ id: ServiceCategoryFilter; label: string }> = [
  { id: "all",            label: "Alle" },
  { id: "infrastructure", label: "Infra" },
  { id: "smart-home",     label: "Smart Home" },
  { id: "media",          label: "Media" },
  { id: "tools",          label: "Tools" },
  { id: "external",       label: "External" },
];

interface Props {
  boardId?: string | undefined;
}

/* "Häufig genutzt" section on the home dashboard.
   Renders only services flagged with pinnedToHome=true; right-side category
   filter narrows the visible cards without leaving the home page. */
export function PinnedServicesSection({ boardId }: Props) {
  const [filter, setFilter] = useState<ServiceCategoryFilter>("all");

  return (
    <section className="pinned-services">
      <div className="pinned-services-head">
        <div>
          <div className="section-kicker">Service Launcher</div>
          <h2 className="pinned-services-title">Häufig genutzt</h2>
        </div>
        <div className="pinned-services-actions">
          <div className="filter-bar" role="tablist" aria-label="Service-Kategorie filtern">
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
          <Link href="/services" className="pinned-services-all-link">
            Alle Services <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>

      <ServiceGrid boardId={boardId} pinnedOnly categoryFilter={filter} />
    </section>
  );
}
