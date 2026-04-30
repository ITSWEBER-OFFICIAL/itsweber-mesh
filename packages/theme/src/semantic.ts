export type ThemePreset = "dark" | "light" | "terminal";

export interface SemanticTokens {
  bg: string;
  surface: string;
  surfaceRaised: string;
  surfaceHover: string;
  border: string;
  borderStrong: string;
  fg: string;
  muted: string;
  dim: string;
  brand: string;
  brandHover: string;
  brandGlow: string;
  brandGlowStrong: string;
  statusOk: string;
  statusWarn: string;
  statusError: string;
  shadowCard: string;
  shadowGlow: string;
}

export const semanticVarMap: Record<keyof SemanticTokens, string> = {
  bg:              "--bg",
  surface:         "--surface",
  surfaceRaised:   "--surface-raised",
  surfaceHover:    "--surface-hover",
  border:          "--border",
  borderStrong:    "--border-strong",
  fg:              "--fg",
  muted:           "--muted",
  dim:             "--dim",
  brand:           "--brand",
  brandHover:      "--brand-hover",
  brandGlow:       "--brand-glow",
  brandGlowStrong: "--brand-glow-strong",
  statusOk:        "--status-ok",
  statusWarn:      "--status-warn",
  statusError:     "--status-error",
  shadowCard:      "--shadow-card",
  shadowGlow:      "--shadow-glow",
};
