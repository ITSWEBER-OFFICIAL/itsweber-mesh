/**
 * WMO Weather Codes (used by Open-Meteo) → lucide-react icon name + German label.
 * Reference: https://open-meteo.com/en/docs (Section "Weather Variable Documentation")
 */

export type WmoIconName =
  | "Sun" | "Moon" | "CloudSun" | "CloudMoon" | "Cloud"
  | "CloudFog" | "CloudDrizzle" | "CloudRain" | "CloudHail"
  | "CloudSnow" | "Snowflake" | "CloudLightning";

export type WmoMapping = {
  iconDay: WmoIconName;
  iconNight: WmoIconName;
  label_de: string;
  label_en: string;
};

export const WMO_CODES: Record<number, WmoMapping> = {
  0:  { iconDay: "Sun",          iconNight: "Moon",        label_de: "Klar",                       label_en: "Clear sky" },
  1:  { iconDay: "Sun",          iconNight: "Moon",        label_de: "Überwiegend klar",           label_en: "Mainly clear" },
  2:  { iconDay: "CloudSun",     iconNight: "CloudMoon",   label_de: "Teilweise bewölkt",          label_en: "Partly cloudy" },
  3:  { iconDay: "Cloud",        iconNight: "Cloud",       label_de: "Bedeckt",                    label_en: "Overcast" },
  45: { iconDay: "CloudFog",     iconNight: "CloudFog",    label_de: "Nebel",                      label_en: "Fog" },
  48: { iconDay: "CloudFog",     iconNight: "CloudFog",    label_de: "Reifnebel",                  label_en: "Depositing rime fog" },
  51: { iconDay: "CloudDrizzle", iconNight: "CloudDrizzle",label_de: "Leichter Nieselregen",       label_en: "Light drizzle" },
  53: { iconDay: "CloudDrizzle", iconNight: "CloudDrizzle",label_de: "Mäßiger Nieselregen",        label_en: "Moderate drizzle" },
  55: { iconDay: "CloudDrizzle", iconNight: "CloudDrizzle",label_de: "Dichter Nieselregen",        label_en: "Dense drizzle" },
  56: { iconDay: "CloudHail",    iconNight: "CloudHail",   label_de: "Leichter gefrierender Niesel",label_en: "Light freezing drizzle" },
  57: { iconDay: "CloudHail",    iconNight: "CloudHail",   label_de: "Dichter gefrierender Niesel",label_en: "Dense freezing drizzle" },
  61: { iconDay: "CloudRain",    iconNight: "CloudRain",   label_de: "Leichter Regen",             label_en: "Slight rain" },
  63: { iconDay: "CloudRain",    iconNight: "CloudRain",   label_de: "Mäßiger Regen",              label_en: "Moderate rain" },
  65: { iconDay: "CloudRain",    iconNight: "CloudRain",   label_de: "Starker Regen",              label_en: "Heavy rain" },
  66: { iconDay: "CloudHail",    iconNight: "CloudHail",   label_de: "Leichter gefrierender Regen",label_en: "Light freezing rain" },
  67: { iconDay: "CloudHail",    iconNight: "CloudHail",   label_de: "Starker gefrierender Regen", label_en: "Heavy freezing rain" },
  71: { iconDay: "CloudSnow",    iconNight: "CloudSnow",   label_de: "Leichter Schneefall",        label_en: "Slight snow fall" },
  73: { iconDay: "CloudSnow",    iconNight: "CloudSnow",   label_de: "Mäßiger Schneefall",         label_en: "Moderate snow fall" },
  75: { iconDay: "CloudSnow",    iconNight: "CloudSnow",   label_de: "Starker Schneefall",         label_en: "Heavy snow fall" },
  77: { iconDay: "Snowflake",    iconNight: "Snowflake",   label_de: "Schneegriesel",              label_en: "Snow grains" },
  80: { iconDay: "CloudRain",    iconNight: "CloudRain",   label_de: "Leichte Regenschauer",       label_en: "Slight rain showers" },
  81: { iconDay: "CloudRain",    iconNight: "CloudRain",   label_de: "Mäßige Regenschauer",        label_en: "Moderate rain showers" },
  82: { iconDay: "CloudRain",    iconNight: "CloudRain",   label_de: "Heftige Regenschauer",       label_en: "Violent rain showers" },
  85: { iconDay: "CloudSnow",    iconNight: "CloudSnow",   label_de: "Leichte Schneeschauer",      label_en: "Slight snow showers" },
  86: { iconDay: "CloudSnow",    iconNight: "CloudSnow",   label_de: "Heftige Schneeschauer",      label_en: "Heavy snow showers" },
  95: { iconDay: "CloudLightning",iconNight:"CloudLightning",label_de:"Gewitter",                  label_en: "Thunderstorm" },
  96: { iconDay: "CloudLightning",iconNight:"CloudLightning",label_de:"Gewitter mit leichtem Hagel",label_en:"Thunderstorm with slight hail" },
  99: { iconDay: "CloudLightning",iconNight:"CloudLightning",label_de:"Gewitter mit starkem Hagel",label_en:"Thunderstorm with heavy hail" },
};

const FALLBACK: WmoMapping = {
  iconDay: "Cloud",
  iconNight: "Cloud",
  label_de: "Unbekannt",
  label_en: "Unknown",
};

export function lookupWmo(code: number): WmoMapping {
  return WMO_CODES[code] ?? FALLBACK;
}

export function wmoIcon(code: number, isDay: boolean): WmoIconName {
  const m = lookupWmo(code);
  return isDay ? m.iconDay : m.iconNight;
}

export function wmoLabel(code: number, locale: "de" | "en" = "de"): string {
  const m = lookupWmo(code);
  return locale === "de" ? m.label_de : m.label_en;
}
