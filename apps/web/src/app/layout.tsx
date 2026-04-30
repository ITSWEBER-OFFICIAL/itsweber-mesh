import type { Metadata } from "next";
import { Geist, Geist_Mono, Saira } from "next/font/google";
import "./globals.css";
import { readConfigForBuild } from "@/server/config/store";

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const saira = Saira({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

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
  let theme = "dark";
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
    })();
  `;

  return (
    <html lang="de" data-theme={theme} data-tab="overview" data-bg-pattern={bgPattern}>
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
        className={`${geist.variable} ${geistMono.variable} ${saira.variable}`}
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
