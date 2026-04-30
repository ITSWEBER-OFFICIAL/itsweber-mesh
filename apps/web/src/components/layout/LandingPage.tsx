import Image from "next/image";
import { LogIn, ShieldCheck } from "lucide-react";

interface LandingPageProps {
  siteName: string;
  subtitle: string;
  authMode: string;
}

export function LandingPage({ siteName, subtitle, authMode }: LandingPageProps) {
  const isOAuth2 = authMode === "oauth2";

  return (
    <div className="landing-shell">
      <div className="landing-card">
        <div className="landing-logo-wrap">
          <Image
            src="/logo-mesh-mark.svg"
            alt={siteName}
            width={40}
            height={40}
            className="landing-logo-img"
          />
        </div>

        <div className="landing-text">
          <h1 className="landing-title">{siteName}</h1>
          {subtitle && <p className="landing-sub">{subtitle}</p>}
        </div>

        <div className="landing-divider" />

        <div className="landing-actions">
          {isOAuth2 ? (
            <a href="/api/auth/oidc/start" className="landing-login-btn">
              <ShieldCheck size={15} />
              <span>Login mit SSO</span>
            </a>
          ) : (
            <a href="/admin/login" className="landing-login-btn">
              <LogIn size={15} />
              <span>Anmelden</span>
            </a>
          )}
        </div>

        <p className="landing-hint">ITSWEBER Mesh · Homelab Dashboard</p>
      </div>
    </div>
  );
}
