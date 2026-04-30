"use client";

import { Suspense, useState, useEffect, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { Providers } from "@/components/providers";

/* ── Token form ─────────────────────────────────────────────────────────── */
function TokenLoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { ok: boolean; reason?: string };
      if (!data.ok) { setError(data.reason ?? `Login fehlgeschlagen (${res.status})`); return; }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Netzwerkfehler");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <label className="login-label">
        <span>Admin-Token</span>
        <input
          type="password" autoFocus required value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="••••••••••••" className="login-input" autoComplete="current-password"
        />
      </label>
      {error && (
        <div className="login-error" role="alert">
          <AlertCircle size={14} /><span>{error}</span>
        </div>
      )}
      <button type="submit" disabled={submitting || !token} className="login-submit">
        {submitting ? "Anmelden…" : "Anmelden"}
      </button>
    </form>
  );
}

/* ── Username/Password form ─────────────────────────────────────────────── */
function UserPasswordLoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { ok: boolean; reason?: string };
      if (!data.ok) { setError(data.reason ?? `Login fehlgeschlagen (${res.status})`); return; }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Netzwerkfehler");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <label className="login-label">
        <span>Benutzername</span>
        <input
          type="text" autoFocus required value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="admin" className="login-input" autoComplete="username"
        />
      </label>
      <label className="login-label">
        <span>Passwort</span>
        <input
          type="password" required value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••••" className="login-input" autoComplete="current-password"
        />
      </label>
      {error && (
        <div className="login-error" role="alert">
          <AlertCircle size={14} /><span>{error}</span>
        </div>
      )}
      <button type="submit" disabled={submitting || !username || !password} className="login-submit">
        {submitting ? "Anmelden…" : "Anmelden"}
      </button>
    </form>
  );
}

/* ── Open mode auto-session ─────────────────────────────────────────────── */
function OpenModeLoginCard({ next }: { next: string }) {
  const router = useRouter();
  useEffect(() => {
    void fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }).then(() => { router.push(next); router.refresh(); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="login-card">
      <div className="login-icon"><ShieldCheck size={28} /></div>
      <h1 className="login-title">Open Mode</h1>
      <p className="login-sub">Dashboard läuft ohne Authentifizierung. Weiterleitung…</p>
    </div>
  );
}

/* ── Login card — resolves auth mode ────────────────────────────────────── */
function LoginCard() {
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const { data: settings } = trpc.settings.get.useQuery();
  const mode = settings?.auth.mode ?? "token";

  if (mode === "open") return <OpenModeLoginCard next={next} />;

  if (mode === "userPassword") {
    return (
      <div className="login-card">
        <div className="login-icon"><ShieldCheck size={28} /></div>
        <h1 className="login-title">Anmelden</h1>
        <p className="login-sub">Melde dich mit deinen ITSWEBER Mesh Zugangsdaten an.</p>
        <UserPasswordLoginForm next={next} />
      </div>
    );
  }

  if (mode === "oauth2") {
    return (
      <div className="login-card">
        <div className="login-icon"><ShieldCheck size={28} /></div>
        <h1 className="login-title">Anmelden via SSO</h1>
        <p className="login-sub">Weiterleitung zum Identity-Provider…</p>
        <a href="/api/auth/oidc/start" className="login-submit login-submit-link">
          Zum Login weiterleiten
        </a>
      </div>
    );
  }

  return (
    <div className="login-card">
      <div className="login-icon"><ShieldCheck size={28} /></div>
      <h1 className="login-title">Admin-Anmeldung</h1>
      <p className="login-sub">
        Gib das Admin-Token ein, das beim Container-Start als{" "}
        <code>ADMIN_TOKEN</code> Environment-Variable gesetzt wurde.
      </p>
      <TokenLoginForm next={next} />
      <p className="login-hint">
        Token vergessen? Setze die <code>ADMIN_TOKEN</code>-Variable im Container-Start neu.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Providers>
      <div className="login-shell">
        <Suspense fallback={
          <div className="login-card">
            <div className="login-icon"><ShieldCheck size={28} /></div>
            <h1 className="login-title">Anmelden</h1>
          </div>
        }>
          <LoginCard />
        </Suspense>
      </div>
    </Providers>
  );
}
