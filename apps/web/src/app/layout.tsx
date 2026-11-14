import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./mesh2.css";
import { readConfigForBuild } from "@/server/config/store";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f2230" },
    { media: "(prefers-color-scheme: dark)", color: "#102633" },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  try {
    const cfg = readConfigForBuild();
    return {
      title: cfg.meta.name,
      description: cfg.meta.subtitle,
      icons: { icon: "/favicon.svg" },
    };
  } catch {
    return {
      title: "ITSWEBER Mesh",
      description: "Homelab Dashboard",
      icons: { icon: "/favicon.svg" },
    };
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let theme: "system" | "light" | "dark" = "system";
  let customCss = "";
  let accent = "#3ba7a7";
  let bgImageSrc = "";
  let bgPattern: "none" | "mesh" | "dots" | "stripes" = "mesh";
  try {
    const cfg = readConfigForBuild();
    theme = cfg.theme.preset;
    customCss = cfg.theme.customCss;
    accent = cfg.theme.accent;
    bgPattern = cfg.theme.backgroundPattern;
    if (cfg.theme.background.kind === "image") {
      bgImageSrc = cfg.theme.background.src;
    }
  } catch {
    // first boot — defaults handled by store
  }

  // Inline-Script läuft VOR jedem Paint — synchron data-theme + data-tab aus localStorage
  // anwenden, damit Theme-Flash bei SPA-Navigate ausbleibt.
  const earlyHtmlAttrs = `
    (function(){
      try {
        var t = localStorage.getItem('itsweber-mesh:active-tab');
        if (t) document.documentElement.setAttribute('data-tab', t);
      } catch(e){}
      try {
        var d = document.documentElement;
        if (d.getAttribute('data-theme-pref') === 'system') {
          d.setAttribute('data-theme', matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
        }
      } catch(e){}
    })();
  `;

  return (
    <html lang="de" data-theme={theme === "light" ? "light" : "dark"} data-theme-pref={theme} data-tab="overview" suppressHydrationWarning data-bg-pattern={bgPattern}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: earlyHtmlAttrs }} />
        <style
          id="user-accent"
          dangerouslySetInnerHTML={{ __html: `:root{--brand:${accent};}` }}
        />
        {/* Custom CSS immer rendern (auch leer), damit ThemeSync nur innerHTML pflegt */}
        <style id="user-custom-css" dangerouslySetInnerHTML={{ __html: customCss }} />
      </head>
      <body
        style={bgImageSrc ? {
          backgroundImage: `url(${JSON.stringify(bgImageSrc)})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
          backgroundRepeat: "no-repeat",
        } : undefined}
      >
        {children}
      </body>
    </html>
  );
}
