import type { MetadataRoute } from "next";

/** v18: Web-Manifest, damit Mesh am iPhone und am PC als App im Vollbild startet. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ITSWEBER Mesh",
    short_name: "Mesh",
    description: "Zustand und Verwaltung der eigenen Infrastruktur",
    lang: "de",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0f2230",
    theme_color: "#0f2230",
    icons: [
      { src: "/icons/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/app-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Dienste", url: "/services" },
      { name: "Hinweise", url: "/hinweise" },
    ],
  };
}
