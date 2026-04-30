"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, ShieldOff, KeyRound, Users, Globe, AlertTriangle, LogOut } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";

const MODE_META = {
  open: {
    label: "Open (kein Auth)",
    description: "Alle Mutations sind ohne Anmeldung möglich. Nur für lokale Entwicklung empfohlen.",
    icon: ShieldOff,
    color: "var(--status-warn)",
    available: true,
  },
  token: {
    label: "Token (Admin-Token)",
    description: "Geteiltes Geheimnis aus der Environment-Variable ADMIN_TOKEN. Cookie-Session nach /admin/login.",
    icon: KeyRound,
    color: "var(--brand)",
    available: true,
  },
  userPassword: {
    label: "User + Passwort",
    description: "Mehrere Benutzer mit bcrypt-gehashten Passwörtern. Verfügbar.",
    icon: Users,
    color: "var(--brand)",
    available: true,
  },
  oauth2: {
    label: "OAuth 2.0 / OIDC",
    description: "SSO via Authentik / Keycloak / generic OIDC. Voll implementiert in v1.4.1 — issuerUrl + clientId + MESH_SESSION_SECRET erforderlich.",
    icon: Globe,
    color: "var(--brand)",
    available: true,
  },
} as const;

type Mode = keyof typeof MODE_META;
const MODES: Mode[] = ["open", "token", "userPassword", "oauth2"];

export default function AuthAdminPage() {
  const toast = useToast();
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.settings.get.useQuery();
  const { data: probe } = trpc.settings.authProbe.useQuery();
  const { data: authCfg } = trpc.settings.getAuthConfig.useQuery();
  const updateAuth = trpc.settings.updateAuth.useMutation({
    onSuccess: () => {
      utils.settings.get.invalidate();
      utils.settings.getAuthConfig.invalidate();
      toast.success("Auth-Modus aktualisiert");
    },
    onError: (e) => toast.error("Fehler", e.message),
  });

  // OIDC config form local state
  const [oidcDraft, setOidcDraft] = useState({
    issuerUrl: "",
    clientId: "",
    clientSecret: "",
    adminGroupClaim: "",
    adminGroupValues: "",
    editorGroupValues: "",
    fallbackRole: "viewer" as "admin" | "editor" | "viewer",
    providerLabel: "",
  });
  useEffect(() => {
    if (authCfg) {
      setOidcDraft({
        issuerUrl: authCfg.oauth2.issuerUrl,
        clientId: authCfg.oauth2.clientId,
        clientSecret: "", // never reveal
        adminGroupClaim: authCfg.oauth2.adminGroupClaim,
        adminGroupValues: authCfg.oauth2.adminGroupValues.join(", "),
        editorGroupValues: authCfg.oauth2.editorGroupValues.join(", "),
        fallbackRole: authCfg.oauth2.fallbackRole,
        providerLabel: authCfg.oauth2.providerLabel,
      });
    }
  }, [authCfg]);

  function saveOidcConfig() {
    const adminGroupValues = oidcDraft.adminGroupValues
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const editorGroupValues = oidcDraft.editorGroupValues
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updateAuth.mutate({
      oauth2: {
        issuerUrl: oidcDraft.issuerUrl.trim(),
        clientId: oidcDraft.clientId.trim(),
        ...(oidcDraft.clientSecret ? { clientSecret: oidcDraft.clientSecret } : {}),
        adminGroupClaim: oidcDraft.adminGroupClaim.trim(),
        adminGroupValues,
        editorGroupValues,
        fallbackRole: oidcDraft.fallbackRole,
        providerLabel: oidcDraft.providerLabel.trim(),
      },
    });
  }

  function handleModeSwitch(mode: Mode) {
    if (mode === "token" && probe?.adminTokenSet === false) {
      toast.error(
        "ADMIN_TOKEN nicht gesetzt",
        "Setze zuerst die Environment-Variable ADMIN_TOKEN im Container und starte ihn neu, sonst sperrst du dich aus.",
      );
      return;
    }
    if (mode === "oauth2" && probe?.sessionSecretSet === false) {
      toast.error(
        "MESH_SESSION_SECRET nicht gesetzt",
        "Setze die Variable mit ≥32 Zeichen (-e MESH_SESSION_SECRET=$(openssl rand -hex 32)) und starte den Container neu.",
      );
      return;
    }
    updateAuth.mutate({ mode });
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Abgemeldet");
      window.location.href = "/admin/login";
    } catch (err) {
      toast.error("Logout fehlgeschlagen", err instanceof Error ? err.message : "");
    }
  }

  if (isLoading || !settings) {
    return <div className="admin-section">Lade…</div>;
  }

  const currentMode: Mode = settings.auth.mode;
  const tokenEnvSet = false; // Cannot verify from client — UI only shows hint
  void tokenEnvSet;

  return (
    <div className="admin-section">
      <header className="admin-section-header">
        <div>
          <h1>Auth-Konfiguration</h1>
          <p>Wähle den Authentifizierungs-Modus für die Admin-API.</p>
        </div>
        <button type="button" onClick={() => void handleLogout()} className="btn-ghost">
          <LogOut size={14} /> Abmelden
        </button>
      </header>

      {currentMode === "open" && (
        <div className="auth-warning-box">
          <AlertTriangle size={16} />
          <div>
            <strong>Aktuell ungeschützt!</strong>
            <p>
              Vor öffentlicher Bereitstellung mindestens auf <code>token</code> wechseln und die
              Environment-Variable <code>ADMIN_TOKEN</code> setzen.
            </p>
          </div>
        </div>
      )}

      {probe && !probe.adminTokenSet && (
        <div className="auth-warning-box">
          <AlertTriangle size={16} />
          <div>
            <strong>ADMIN_TOKEN ist NICHT gesetzt.</strong>
            <p>
              Token-Mode wird abgelehnt, solange die Environment-Variable fehlt. Sonst sperrst du dich aus.
              <br />
              Setze sie z.B. via Unraid Docker-UI:
              {" "}<code>-e ADMIN_TOKEN=&lt;langer-zufalls-string&gt;</code>
              {" "}und starte den Container neu.
            </p>
          </div>
        </div>
      )}

      <div className="auth-mode-grid">
        {MODES.map((mode) => {
          const meta = MODE_META[mode];
          const Icon = meta.icon;
          const isSelected = currentMode === mode;
          return (
            <button
              key={mode}
              type="button"
              disabled={
                !meta.available ||
                updateAuth.isPending ||
                (mode === "oauth2" && probe?.sessionSecretSet === false)
              }
              onClick={() => handleModeSwitch(mode)}
              className={`auth-mode-card ${isSelected ? "selected" : ""} ${!meta.available ? "disabled" : ""}`}
            >
              <div className="auth-mode-icon" style={{ color: meta.color }}>
                <Icon size={20} />
              </div>
              <div className="auth-mode-body">
                <div className="auth-mode-title">
                  {meta.label}
                  {isSelected && <span className="auth-mode-badge">Aktiv</span>}
                  {!meta.available && <span className="auth-mode-badge muted">Bald</span>}
                </div>
                <p className="auth-mode-desc">{meta.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {currentMode === "token" && (
        <div className="auth-info-box">
          <ShieldCheck size={16} />
          <div>
            <strong>Token-Modus aktiv.</strong>
            <p>
              Stelle sicher, dass <code>ADMIN_TOKEN</code> als Environment-Variable im Container
              gesetzt ist. Beim Container-Start ohne Token werden alle Admin-Mutations abgelehnt.
              Login unter <a href="/admin/login">/admin/login</a>.
            </p>
          </div>
        </div>
      )}

      {authCfg?.migrationWarnings.includes("oauth2-mode-reset-incomplete-config-v13") && (
        <div className="auth-warning-box">
          <AlertTriangle size={16} />
          <div>
            <strong>OIDC-Konfiguration wurde beim Schema-Upgrade auf v13 zurückgesetzt.</strong>
            <p>
              Die alte v1.4.0-Implementierung war unsicher und akzeptierte gefälschte Cookies.
              Wir haben den Modus auf <code>open</code> umgestellt, um keinen Lockout zu riskieren.
              Setze die OIDC-Felder unten neu, dann kannst du auf <code>oauth2</code> umschalten.
            </p>
          </div>
        </div>
      )}

      {probe && !probe.sessionSecretSet && (
        <div className="auth-warning-box">
          <AlertTriangle size={16} />
          <div>
            <strong>MESH_SESSION_SECRET ist NICHT gesetzt (oder zu kurz).</strong>
            <p>
              Pflicht für OIDC-Mode. Setze die Variable mit ≥32 zufälligen Zeichen:
              {" "}<code>-e MESH_SESSION_SECRET=$(openssl rand -hex 32)</code>{" "}
              und starte den Container neu. Solange sie fehlt, kann <code>oauth2</code> nicht aktiviert werden.
            </p>
          </div>
        </div>
      )}

      {currentMode === "oauth2" && (
        <div className="auth-info-box">
          <ShieldCheck size={16} />
          <div>
            <strong>OIDC-Modus aktiv.</strong>
            <p>
              Login unter <a href="/admin/login">/admin/login</a> → „Zum Login weiterleiten".
              Callback-Pfad: <code>/api/auth/oidc/callback</code>. Logout: <code>/api/auth/oidc/logout</code>.
            </p>
          </div>
        </div>
      )}

      {/* OIDC configuration form — always visible so users can set it up before switching mode */}
      <div className="admin-card">
        <div className="admin-card-title auth-oidc-title">
          <Globe size={15} className="auth-oidc-title-icon" />
          OIDC / OAuth 2.0 Konfiguration
        </div>
        <div className="admin-card-sub">
          Konfiguriere deinen Identity-Provider (Authentik, Keycloak, Auth0, generic OIDC).
          Speichere die Felder, bevor du den Modus auf <code className="auth-oidc-code">oauth2</code> umstellst.
        </div>

        <div className="auth-oidc-grid">
          <div className="admin-field auth-oidc-full">
            <span className="admin-label">Issuer-URL</span>
            <input
              className="admin-input"
              type="url"
              value={oidcDraft.issuerUrl}
              onChange={(e) => setOidcDraft((d) => ({ ...d, issuerUrl: e.target.value }))}
              placeholder="https://auth.example.com/application/o/app-slug/"
            />
          </div>

          <div className="admin-field">
            <span className="admin-label">Client-ID</span>
            <input
              className="admin-input"
              type="text"
              value={oidcDraft.clientId}
              onChange={(e) => setOidcDraft((d) => ({ ...d, clientId: e.target.value }))}
              placeholder="mesh-dashboard"
            />
          </div>

          <div className="admin-field">
            <span className="admin-label">
              Client-Secret
              {authCfg?.oauth2.hasClientSecret && (
                <span className="auth-oidc-secret-hint">gesetzt — leer lassen zum Behalten</span>
              )}
            </span>
            <input
              className="admin-input"
              type="password"
              value={oidcDraft.clientSecret}
              onChange={(e) => setOidcDraft((d) => ({ ...d, clientSecret: e.target.value }))}
              placeholder={authCfg?.oauth2.hasClientSecret ? "••••••••" : "optional bei Public Clients"}
              autoComplete="new-password"
            />
          </div>

          <div className="admin-field">
            <span className="admin-label">Anzeige-Name (Provider-Label)</span>
            <input
              className="admin-input"
              type="text"
              value={oidcDraft.providerLabel}
              onChange={(e) => setOidcDraft((d) => ({ ...d, providerLabel: e.target.value }))}
              placeholder="Authentik"
            />
          </div>

          <div className="admin-field">
            <span className="admin-label">Group-Claim</span>
            <input
              className="admin-input"
              type="text"
              value={oidcDraft.adminGroupClaim}
              onChange={(e) => setOidcDraft((d) => ({ ...d, adminGroupClaim: e.target.value }))}
              placeholder="groups"
            />
          </div>

          <div className="admin-field">
            <span className="admin-label">Admin-Gruppen (komma-getrennt)</span>
            <input
              className="admin-input"
              type="text"
              value={oidcDraft.adminGroupValues}
              onChange={(e) => setOidcDraft((d) => ({ ...d, adminGroupValues: e.target.value }))}
              placeholder="mesh-admin"
            />
          </div>

          <div className="admin-field">
            <span className="admin-label">Editor-Gruppen (komma-getrennt)</span>
            <input
              className="admin-input"
              type="text"
              value={oidcDraft.editorGroupValues}
              onChange={(e) => setOidcDraft((d) => ({ ...d, editorGroupValues: e.target.value }))}
              placeholder="mesh-editor"
            />
          </div>

          <div className="admin-field">
            <span className="admin-label">Fallback-Rolle (kein Group-Match)</span>
            <select
              className="admin-input"
              aria-label="Fallback-Rolle bei fehlendem Group-Match"
              value={oidcDraft.fallbackRole}
              onChange={(e) =>
                setOidcDraft((d) => ({
                  ...d,
                  fallbackRole: e.target.value as "admin" | "editor" | "viewer",
                }))
              }
            >
              <option value="viewer">viewer — nur lesen (empfohlen)</option>
              <option value="editor">editor — Inhalte bearbeiten</option>
              <option value="admin">admin — voller Zugriff (riskant)</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          className="btn-primary auth-oidc-save-btn"
          onClick={saveOidcConfig}
          disabled={updateAuth.isPending}
        >
          OIDC-Konfiguration speichern
        </button>
      </div>
    </div>
  );
}
