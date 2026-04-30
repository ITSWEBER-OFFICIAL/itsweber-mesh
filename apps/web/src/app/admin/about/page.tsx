import Image from "next/image";
import { ExternalLink, Heart } from "lucide-react";

const PROJECT = {
  name: "ITSWEBER Mesh",
  tagline: "Homelab Dashboard · Self-Hosted",
  authorName: "ITSWEBER",
  authorUrl: "https://itsweber.de",
  authorLogoSrc: "/itsweber-brand.png",
  copyrightStartYear: 2025,
} as const;

const TECH_STACK: Array<[string, string]> = [
  ["Framework",   "Next.js 15 (App Router)"],
  ["API",         "tRPC v11 + React Query v5"],
  ["Sprache",     "TypeScript 5.7 strict"],
  ["Styling",     "Tailwind v4"],
  ["Persistenz",  "JSON + proper-lockfile"],
  ["Container",   "Docker (Alpine, Standalone)"],
];

export default function AdminAboutPage() {
  const year = new Date().getFullYear();
  const copyrightRange =
    year > PROJECT.copyrightStartYear
      ? `${PROJECT.copyrightStartYear}–${year}`
      : `${PROJECT.copyrightStartYear}`;

  return (
    <div className="admin-card about-page">
      {/* Hero — App-Mark + Project Identity */}
      <header className="about-hero">
        <div className="about-hero-mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mesh-mark.svg"
            alt={PROJECT.name}
            width={28}
            height={28}
            className="about-hero-mark-img"
          />
        </div>
        <div>
          <h1 className="about-hero-title">{PROJECT.name}</h1>
          <p className="about-hero-tagline">{PROJECT.tagline}</p>
        </div>
      </header>

      {/* About */}
      <section className="about-section">
        <h2 className="about-section-label">Über dieses Projekt</h2>
        <p className="about-section-text">
          {PROJECT.name} ist ein selbstgehostetes Homelab-Dashboard für alle, die ihre Heim-Infrastruktur
          übersichtlich verwalten möchten. Services, Widgets, Kameras, Server-Status, Netzwerk-Geräte —
          alles in einem Interface, ohne Cloud-Abhängigkeit.
        </p>
      </section>

      <div className="admin-divider" />

      {/* Maintainer */}
      <section className="about-section">
        <h2 className="about-section-label">Maintainer · Made with <Heart size={11} className="about-heart" /> by</h2>
        <a
          href={PROJECT.authorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="about-author-card"
        >
          <Image
            src={PROJECT.authorLogoSrc}
            alt={PROJECT.authorName}
            width={56}
            height={56}
            className="about-author-logo"
          />
          <div className="about-author-text">
            <span className="about-author-name">{PROJECT.authorName}</span>
            <span className="about-author-url">
              {PROJECT.authorUrl.replace(/^https?:\/\//, "")} <ExternalLink size={12} />
            </span>
          </div>
        </a>
      </section>

      <div className="admin-divider" />

      {/* Tech */}
      <section className="about-section">
        <h2 className="about-section-label">Technologie</h2>
        <div className="about-tech-grid">
          {TECH_STACK.map(([label, value]) => (
            <div key={label} className="about-tech-row">
              <span className="about-tech-label">{label}</span>
              <span className="about-tech-value">{value}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="admin-divider" />

      {/* Copyright Footer */}
      <footer className="about-footer">
        <span>© {copyrightRange} {PROJECT.authorName} · MIT License</span>
        <span className="about-footer-url">{PROJECT.authorUrl.replace(/^https?:\/\//, "")}</span>
      </footer>
    </div>
  );
}
