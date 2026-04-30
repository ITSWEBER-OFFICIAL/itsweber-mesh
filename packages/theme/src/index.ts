export type { ThemePreset, SemanticTokens } from "./semantic.js";
export { semanticVarMap } from "./semantic.js";

import tokens from "../tokens.json" assert { type: "json" };
export { tokens };

export const THEME_PRESETS = ["dark", "light", "terminal"] as const;
export const DEFAULT_PRESET = "dark" as const;
export const DEFAULT_ACCENT = "#3ba7a7" as const;

export function getDataThemeAttr(preset: string): string {
  return preset;
}
