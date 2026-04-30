import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "12px",
        fontFamily: "var(--font-mono, monospace)",
        color: "var(--muted)",
      }}
    >
      <span style={{ fontSize: "48px", color: "var(--brand)" }}>404</span>
      <p style={{ letterSpacing: "2px", textTransform: "uppercase", fontSize: "12px" }}>
        Seite nicht gefunden
      </p>
      <Link
        href="/"
        style={{
          marginTop: "8px",
          fontSize: "11px",
          color: "var(--brand)",
          letterSpacing: "1px",
          textDecoration: "underline",
        }}
      >
        Zurück zum Dashboard
      </Link>
    </div>
  );
}
