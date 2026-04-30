"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Search, LayoutGrid, Columns3, Link2, ExternalLink, X } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { useLocalSearch, type SearchResult } from "@/hooks/useLocalSearch";
import { useRouter } from "next/navigation";

const KIND_ICONS: Record<SearchResult["kind"], React.ReactNode> = {
  service:   <LayoutGrid size={14} />,
  board:     <Columns3 size={14} />,
  quickLink: <Link2 size={14} />,
  widget:    <LayoutGrid size={14} />,
};

const KIND_LABELS: Record<SearchResult["kind"], string> = {
  service:   "Service",
  board:     "Board",
  quickLink: "Quick-Link",
  widget:    "Widget",
};

const META_HINT = typeof navigator !== "undefined" && /mac/i.test(navigator.platform) ? "⌘K" : "Strg+K";

export function HeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const localResults = useLocalSearch(query);
  const { data: searchCfg } = trpc.search.getConfig.useQuery(undefined, { staleTime: 60_000 });
  const engines = searchCfg?.engines ?? [];
  const defaultEngine = engines.find((e) => e.id === searchCfg?.defaultEngineId) ?? engines[0];
  const otherEngines = engines.filter((e) => e.id !== defaultEngine?.id);

  const trimmed = query.trim();
  const totalItems = localResults.length + (trimmed ? engines.length : 0);

  /* Global Ctrl/Cmd+K opens the modal. Esc closes via Radix default. */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Reset state on close so the next opening starts clean. */
  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIdx(0);
    }
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const openWebSearch = useCallback((engine: typeof defaultEngine, q: string) => {
    if (!engine || !q.trim()) return;
    const url = engine.urlTemplate.replace("{q}", encodeURIComponent(q.trim()));
    window.open(url, "_blank", "noopener,noreferrer");
    close();
  }, [close]);

  const navigate = useCallback((result: SearchResult) => {
    if (result.url) {
      if (result.kind === "service" || result.kind === "quickLink") {
        window.open(result.url, "_blank", "noopener,noreferrer");
      } else {
        router.push(result.url);
      }
    }
    close();
  }, [router, close]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(totalItems - 1, 0)));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx < localResults.length) {
        const r = localResults[activeIdx];
        if (r) navigate(r);
      } else if (trimmed && engines.length > 0) {
        const engineIdx = activeIdx - localResults.length;
        const engine = engines[Math.max(0, engineIdx)];
        if (engine) openWebSearch(engine, query);
      }
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className="header-search-trigger" aria-label="Suchen">
          <Search size={14} className="header-search-icon" />
          <span className="header-search-trigger-text">Suchen…</span>
          <span className="header-search-trigger-kbd">{META_HINT}</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className="search-modal-shell"
          onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
        >
          <Dialog.Title className="sr-only">Suchen</Dialog.Title>
          <Dialog.Description className="sr-only">
            Lokale Treffer und Web-Suche
          </Dialog.Description>

          <div className="search-modal-card">
          <div className="search-modal-input-row">
            <Search size={18} className="search-modal-icon" />
            <input
              ref={inputRef}
              type="text"
              className="search-modal-input"
              placeholder="Service, Board oder Quick-Link suchen…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
              onKeyDown={onKeyDown}
              autoComplete="off"
              spellCheck={false}
            />
            <Dialog.Close asChild>
              <button type="button" className="search-modal-close" aria-label="Schließen">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="search-modal-body">
            {!trimmed && (
              <div className="search-modal-empty">
                Tippe einen Begriff — Services, Boards, Quick-Links und Widgets werden lokal gefunden,
                der Rest geht an deine Web-Suchmaschine.
              </div>
            )}

            {trimmed && localResults.length === 0 && (
              <div className="search-modal-empty">Keine lokalen Treffer für „{query}".</div>
            )}

            {localResults.length > 0 && (
              <div className="search-modal-section">
                <span className="search-modal-section-label">Lokal</span>
                {localResults.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`search-modal-item${i === activeIdx ? " search-modal-item-active" : ""}`}
                    onClick={() => navigate(r)}
                    onMouseEnter={() => setActiveIdx(i)}
                  >
                    <span className="search-modal-item-icon">{KIND_ICONS[r.kind]}</span>
                    <span className="search-modal-item-title">{r.title}</span>
                    {r.subtitle && <span className="search-modal-item-sub">{r.subtitle}</span>}
                    <span className="search-modal-item-kind">{KIND_LABELS[r.kind]}</span>
                  </button>
                ))}
              </div>
            )}

            {trimmed && engines.length > 0 && (
              <div className="search-modal-section">
                <span className="search-modal-section-label">Web</span>
                {(defaultEngine ? [defaultEngine, ...otherEngines] : engines).map((engine, i) => {
                  const idx = localResults.length + i;
                  return (
                    <button
                      key={engine.id}
                      type="button"
                      className={`search-modal-item${idx === activeIdx ? " search-modal-item-active" : ""}`}
                      onClick={() => openWebSearch(engine, query)}
                      onMouseEnter={() => setActiveIdx(idx)}
                    >
                      <span className="search-modal-item-icon"><ExternalLink size={14} /></span>
                      <span className="search-modal-item-title">
                        Bei {engine.name} suchen: „{query}"
                      </span>
                      {engine.hotkey && (
                        <span className="search-modal-item-hotkey">{engine.hotkey}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="search-modal-footer">
            <span><kbd>↑</kbd><kbd>↓</kbd> navigieren</span>
            <span><kbd>↵</kbd> öffnen</span>
            <span><kbd>Esc</kbd> schließen</span>
          </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
