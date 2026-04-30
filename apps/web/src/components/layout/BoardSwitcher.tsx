"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, LayoutDashboard, Plus, Check } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc-client";

export function BoardSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: boards = [] } = trpc.boards.list.useQuery(undefined, { staleTime: 30_000 });

  const currentBoard = boards.find((b) => {
    if (pathname === "/" || pathname === "") return b.isHome;
    const slug = pathname.split("/").pop();
    return b.slug === slug;
  }) ?? boards.find((b) => b.isHome) ?? boards[0];

  if (boards.length === 0) {
    return (
      <button type="button" className="board-switcher-trigger board-switcher-trigger--empty" disabled>
        <LayoutDashboard size={13} />
        <span className="board-switcher-name">Kein Board</span>
      </button>
    );
  }

  function getBoardHref(b: typeof boards[number]) {
    return b.isHome ? "/" : `/boards/${b.slug}`;
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="board-switcher-trigger">
          <LayoutDashboard size={13} />
          <span className="board-switcher-name">{currentBoard?.name ?? "Board"}</span>
          <ChevronDown size={11} className="board-switcher-chevron" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content className="board-switcher-menu" sideOffset={6} align="start">
          {[...boards].sort((a, b) => a.sortOrder - b.sortOrder).map((b) => (
            <DropdownMenu.Item
              key={b.id}
              className="board-switcher-item"
              onSelect={() => router.push(getBoardHref(b))}
            >
              <span className="board-switcher-item-icon">
                {b.id === currentBoard?.id
                  ? <Check size={12} className="text-[var(--brand)]" />
                  : <LayoutDashboard size={12} className="text-[var(--dim)]" />}
              </span>
              <span className="board-switcher-item-name">{b.name}</span>
              {b.isHome && <span className="board-switcher-home-badge">Home</span>}
            </DropdownMenu.Item>
          ))}

          <DropdownMenu.Separator className="board-switcher-sep" />

          <DropdownMenu.Item
            className="board-switcher-item board-switcher-item--add"
            onSelect={() => router.push("/admin/boards")}
          >
            <Plus size={12} />
            <span>Boards verwalten</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
