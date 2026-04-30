"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CheckCircle2, ChevronRight, User, Globe, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";
import { Providers } from "@/components/providers";

/* ── Step definitions ─────────────────────────────────────────────────────── */
const STEPS = ["Willkommen", "Admin-Account", "Fertig"] as const;
type Step = (typeof STEPS)[number];

/* ── Main wizard ──────────────────────────────────────────────────────────── */
export default function SetupPage() {
  return (
    <Providers>
      <SetupWizard />
    </Providers>
  );
}

function SetupWizard() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<Step>("Willkommen");
  const [locale, setLocale] = useState<"de" | "en">("de");
  const [adminCreated, setAdminCreated] = useState(false);

  const createUser = trpc.users.create.useMutation({
    onError: (e) => toast.error("Fehler", e.message),
  });
  const updateMeta = trpc.settings.updateMeta.useMutation();
  const updateAuth = trpc.settings.updateAuth.useMutation();
  const completeFirstRun = trpc.settings.completeFirstRun.useMutation();

  const stepIdx = STEPS.indexOf(step);

  // Order matters: updateMeta + updateAuth are adminProcedure. We must run
  // them while auth.mode is still the default "open" (synthetic admin),
  // before any redirect-on-userPassword check can lock us out. The mode
  // switch to "userPassword" happens here at the very end so the wizard's
  // last step still has admin rights to call all three settings mutations.
  async function handleFinish() {
    try {
      await updateMeta.mutateAsync({ locale });
      await completeFirstRun.mutateAsync();
      if (adminCreated) {
        await updateAuth.mutateAsync({ mode: "userPassword" });
      }
      router.push(adminCreated ? "/admin/login" : "/admin");
    } catch (e) {
      toast.error("Setup konnte nicht abgeschlossen werden", e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="setup-shell">
      {/* Progress bar */}
      <div className="setup-progress">
        {STEPS.map((s, i) => (
          <div key={s} className="setup-progress-item">
            <div className={`setup-progress-dot${i <= stepIdx ? " active" : ""}`}>
              {i < stepIdx ? <CheckCircle2 size={14} /> : <span>{i + 1}</span>}
            </div>
            <span className={`setup-progress-label${i === stepIdx ? " current" : ""}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`setup-progress-line${i < stepIdx ? " done" : ""}`} />}
          </div>
        ))}
      </div>

      <div className="setup-card">
        {step === "Willkommen" && (
          <WelcomeStep locale={locale} onLocaleChange={setLocale} onNext={() => setStep("Admin-Account")} />
        )}
        {step === "Admin-Account" && (
          <AdminAccountStep
            onSkip={() => setStep("Fertig")}
            onNext={async (data) => {
              await createUser.mutateAsync({
                username: data.username,
                password: data.password,
                role: "admin",
              });
              setAdminCreated(true);
              setStep("Fertig");
            }}
            isPending={createUser.isPending}
          />
        )}
        {step === "Fertig" && (
          <FinishStep
            adminCreated={adminCreated}
            onFinish={handleFinish}
            isPending={completeFirstRun.isPending || updateMeta.isPending || updateAuth.isPending}
          />
        )}
      </div>
    </div>
  );
}

/* ── Step 1: Willkommen ───────────────────────────────────────────────────── */
function WelcomeStep({
  locale,
  onLocaleChange,
  onNext,
}: {
  locale: "de" | "en";
  onLocaleChange: (l: "de" | "en") => void;
  onNext: () => void;
}) {
  return (
    <>
      <div className="setup-logo">
        <div className="setup-logo-mark">
          <Image src="/logo-mesh-mark.svg" alt="Mesh" width={32} height={32} style={{ filter: "brightness(0) invert(1)" }} />
        </div>
        <div>
          <div className="setup-logo-name">ITSWEBER Mesh</div>
          <div className="setup-logo-sub">Homelab Dashboard</div>
        </div>
      </div>

      <h1 className="setup-title">Willkommen</h1>
      <p className="setup-desc">
        Richte dein ITSWEBER Mesh Dashboard ein. Dieser Assistent führt dich in wenigen Schritten durch die Erstkonfiguration.
      </p>

      <div className="setup-field">
        <label className="setup-label">Sprache / Language</label>
        <div className="setup-locale-row">
          {(["de", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              className={`setup-locale-btn${locale === l ? " active" : ""}`}
              onClick={() => onLocaleChange(l)}
            >
              <Globe size={14} />
              {l === "de" ? "Deutsch" : "English"}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="btn-primary setup-next-btn" onClick={onNext}>
        Los geht&apos;s <ChevronRight size={15} />
      </button>
    </>
  );
}

/* ── Step 2: Admin-Account ────────────────────────────────────────────────── */
function AdminAccountStep({
  onNext,
  onSkip,
  isPending,
}: {
  onNext: (data: { username: string; password: string }) => Promise<void>;
  onSkip: () => void;
  isPending: boolean;
}) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Passwort muss mindestens 8 Zeichen haben"); return; }
    if (password !== confirm) { setError("Passwörter stimmen nicht überein"); return; }
    await onNext({ username, password });
  }

  return (
    <>
      <div className="setup-step-icon"><User size={28} /></div>
      <h1 className="setup-title">Admin-Account anlegen</h1>
      <p className="setup-desc">
        Lege den ersten Admin-Benutzer an. Du kannst dich damit in Mesh einloggen, wenn du den Modus <strong>userPassword</strong> aktivierst.
      </p>

      <form onSubmit={handleSubmit} className="setup-form">
        <div className="setup-field">
          <label className="setup-label">Benutzername</label>
          <input
            className="admin-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="setup-field">
          <label className="setup-label">Passwort</label>
          <input
            className="admin-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <div className="setup-field">
          <label className="setup-label">Passwort bestätigen</label>
          <input
            className="admin-input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        {error && <p className="setup-error">{error}</p>}

        <div className="setup-actions">
          <button type="button" className="btn-ghost" onClick={onSkip}>Überspringen</button>
          <button type="submit" className="btn-primary" disabled={isPending || !username || !password}>
            {isPending ? "Anlege…" : "Account anlegen"}
          </button>
        </div>
      </form>
    </>
  );
}

/* ── Step 3: Fertig ───────────────────────────────────────────────────────── */
function FinishStep({
  adminCreated,
  onFinish,
  isPending,
}: {
  adminCreated: boolean;
  onFinish: () => void;
  isPending: boolean;
}) {
  return (
    <>
      <div className="setup-step-icon setup-step-icon-success"><ShieldCheck size={32} /></div>
      <h1 className="setup-title">Alles bereit!</h1>
      <p className="setup-desc">
        {adminCreated
          ? "Dein Admin-Account wurde angelegt und der Login-Modus auf „User + Passwort“ gesetzt. Melde dich jetzt mit deinen Zugangsdaten an."
          : "Du hast keinen Admin-Account angelegt. Das Dashboard läuft im offenen Modus — jede Person mit Netzwerk-Zugang hat Admin-Rechte. Du kannst unter Admin → Auth jederzeit einen Modus aktivieren."}
      </p>

      <div className="setup-checklist">
        <div className="setup-check-item"><CheckCircle2 size={15} /> Dashboard bereit</div>
        {adminCreated && <div className="setup-check-item"><CheckCircle2 size={15} /> Admin-Account angelegt</div>}
        {adminCreated && <div className="setup-check-item"><CheckCircle2 size={15} /> Login-Modus: User + Passwort aktiv</div>}
        <div className="setup-check-item"><CheckCircle2 size={15} /> Standard-Boards konfiguriert</div>
        <div className="setup-check-item"><CheckCircle2 size={15} /> Suchmaschinen eingerichtet</div>
      </div>

      <button type="button" className="btn-primary setup-next-btn" onClick={onFinish} disabled={isPending}>
        {isPending ? "Starte…" : "Zum Dashboard"}
      </button>
    </>
  );
}
