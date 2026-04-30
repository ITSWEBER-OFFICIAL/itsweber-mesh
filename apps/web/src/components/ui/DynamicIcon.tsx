"use client";

import { useState } from "react";

/**
 * DynamicIcon — rendert einen Icon-Wert kontextsensitiv.
 *
 * Wert kann sein:
 *   • Emoji-Zeichen (z. B. "🔗")
 *   • Externer URL (https://...)
 *   • Absoluter Pfad (/icons/foo.svg)
 *
 * Brand-Logo-Strategie:
 *   • PNG bevorzugt (Original-Logos mit Markenfarben)
 *   • SVG-Fallback bei PNG-404 (via onError)
 *
 * Bei PNG-URLs aus dashboard-icons (.../png/<slug>.png) versucht der Renderer
 * automatisch die SVG-Variante (.../svg/<slug>.svg) als Fallback, falls PNG fehlt.
 */
export function DynamicIcon({
  value,
  size = 14,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const [src, setSrc] = useState(value);
  const [failed, setFailed] = useState(false);

  if (!value) return null;

  const isUrl = /^(https?:|\/)/.test(value);
  if (!isUrl) {
    return <span className={className}>{value}</span>;
  }

  if (failed) {
    return <span className={className} aria-hidden="true">○</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={className}
      loading="lazy"
      decoding="async"
      style={{ display: "inline-block", objectFit: "contain" }}
      onError={() => {
        // Erster Fallback: PNG → SVG (dashboard-icons-Pattern)
        if (src.includes("/png/") && src.endsWith(".png")) {
          const svgUrl = src.replace("/png/", "/svg/").replace(/\.png$/, ".svg");
          setSrc(svgUrl);
          return;
        }
        // Letzter Ausweg: Marker setzen
        setFailed(true);
      }}
    />
  );
}
