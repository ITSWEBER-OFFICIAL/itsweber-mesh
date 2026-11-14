"use client";

import type { Segment } from "@/lib/service-view";

const CX = 170;
const CY = 122;
const R = 80;
const GAP = 5;

/** Lagering: ein Segment je Bereich, antippen zeigt den Bereich. */
export function Ring({
  segments,
  urgent,
  selected,
  onSelect,
}: {
  segments: Segment[];
  urgent: number;
  selected: number;
  onSelect: (index: number) => void;
}) {
  const n = segments.length;
  const circumference = 2 * Math.PI * R;
  const step = n > 0 ? 360 / n : 360;
  const span = n > 1 ? step - GAP : 360;
  const dash = (circumference * span) / 360;
  const sel = selected >= 0 ? segments[selected] : undefined;

  return (
    <svg className="m-ring" viewBox="0 0 340 242" role="group" aria-label="Lagering">
      <circle cx={CX} cy={CY} r={64} fill="none" stroke="var(--m-head-line)" strokeWidth={6} strokeDasharray="1 5.7" />
      {segments.map((seg, i) => {
        const center = -90 + step / 2 + step * i;
        const rad = (center * Math.PI) / 180;
        const co = Math.cos(rad);
        const rotate = `rotate(${center - span / 2} ${CX} ${CY})`;
        const toggle = () => onSelect(selected === i ? -1 : i);
        return (
          <g
            key={seg.category}
            className={`seg ${seg.state} ${selected === i ? "sel" : ""}`}
            role="button"
            tabIndex={0}
            aria-pressed={selected === i}
            aria-label={`${seg.label}, ${seg.ok} von ${seg.total} laufen${seg.bad ? `, ${seg.bad} gestört` : ""}`}
            onClick={toggle}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggle();
              }
            }}
          >
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="transparent" strokeWidth={46} strokeDasharray={`${dash} ${circumference - dash}`} transform={rotate} />
            <circle className="v" cx={CX} cy={CY} r={R} fill="none" strokeWidth={13} strokeDasharray={`${dash} ${circumference - dash}`} transform={rotate} />
            <text
              x={CX + 107 * co}
              y={CY + 107 * Math.sin(rad) + 4}
              fontSize={11}
              letterSpacing={1}
              textAnchor={co > 0.3 ? "start" : co < -0.3 ? "end" : "middle"}
            >
              {seg.short}
              {seg.bad ? ` ${seg.bad}` : ""}
            </text>
          </g>
        );
      })}
      <text x={CX} y={CY + 12} textAnchor="middle" fontSize={52} fontWeight={600} style={{ fontFamily: "var(--m-f-display)" }}>
        {sel ? sel.bad : urgent}
      </text>
      <text x={CX} y={CY + 31} textAnchor="middle" fontSize={11} letterSpacing={1.6} style={{ fill: "var(--m-on-head2)" }}>
        {sel ? sel.short : "DRINGEND"}
      </text>
    </svg>
  );
}
