"use client";

import type { Hint } from "@/app/api/hints/route";
import { Dot } from "./AppShell";

export { useHints } from "./useHints";

export function HintList({ hints, limit }: { hints: Hint[]; limit?: number }) {
  const list = limit ? hints.slice(0, limit) : hints;
  return (
    <>
      {list.map((h) => (
        <div className="m-msg" key={h.id}>
          <Dot state={h.level === "urgent" ? "bad" : "warn"} />
          <div>
            <b>{h.title}</b>
            <small>{h.detail}</small>
          </div>
        </div>
      ))}
    </>
  );
}
