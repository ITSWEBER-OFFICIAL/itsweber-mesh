import { NextResponse } from "next/server";
import { readConfig } from "@/server/config/store";
import { wmoIcon, wmoLabel, type WmoIconName } from "@/lib/weather-codes";
import { requireApiAuth } from "@/server/auth/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type WeatherDailyEntry = {
  date: string;            // ISO date YYYY-MM-DD
  weatherCode: number;
  icon: WmoIconName;       // day icon for daily forecast
  label: string;
  tempMax: number;
  tempMin: number;
  precipProbabilityMax: number;
  sunrise: string;
  sunset: string;
};

export type WeatherWidgetData = {
  configured: boolean;
  online: boolean;
  error?: string;
  current?: {
    temperature: number;
    apparent: number;
    weatherCode: number;
    label: string;
    icon: WmoIconName;
    isDay: boolean;
    windSpeed: number;
    windDirection: number;
    humidity?: number;
  };
  location?: {
    name: string;
    latitude: number;
    longitude: number;
  };
  unit?: "celsius" | "fahrenheit";
  daily?: WeatherDailyEntry[];
};

type OpenMeteoResponse = {
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    is_day?: 0 | 1;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    relative_humidity_2m?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
};

/* In-memory cache keyed by lat,lon — Open-Meteo free-tier is 600/min,
   we call at most every ~refreshIntervalMin minutes per coord pair. */
type CacheEntry = { data: WeatherWidgetData; fetchedAt: number };
declare global {
  // eslint-disable-next-line no-var
  var __weatherCache: Map<string, CacheEntry> | undefined;
}
function cache(): Map<string, CacheEntry> {
  if (!globalThis.__weatherCache) globalThis.__weatherCache = new Map();
  return globalThis.__weatherCache;
}

export async function GET(req: Request): Promise<NextResponse<WeatherWidgetData>> {
  const deny = await requireApiAuth(req);
  if (deny) return deny;

  const cfg = readConfig();
  const w = cfg.integrations.weather;

  // Treat missing coordinates as not-configured. `enabled` defaults to true on save —
  // users that explicitly set it to false get an unconfigured response too.
  if (w.latitude === 0 && w.longitude === 0) {
    return NextResponse.json({ configured: false, online: false });
  }
  if (!w.enabled) {
    return NextResponse.json({ configured: false, online: false });
  }

  const key = `${w.latitude},${w.longitude},${w.unit}`;
  const ttlMs = Math.max(5, w.refreshIntervalMin) * 60 * 1000;
  const now = Date.now();
  const hit = cache().get(key);
  if (hit && now - hit.fetchedAt < ttlMs) {
    return NextResponse.json(hit.data);
  }

  const tempUnit = w.unit === "fahrenheit" ? "fahrenheit" : "celsius";
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(w.latitude));
  url.searchParams.set("longitude", String(w.longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,wind_direction_10m,relative_humidity_2m",
  );
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
  );
  url.searchParams.set("temperature_unit", tempUnit);
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const data: WeatherWidgetData = {
        configured: true,
        online: false,
        error: `Open-Meteo HTTP ${res.status}`,
      };
      return NextResponse.json(data);
    }
    const json = (await res.json()) as OpenMeteoResponse;
    const current = json.current;
    const daily = json.daily;
    const isDay = current?.is_day === 1;

    const data: WeatherWidgetData = {
      configured: true,
      online: true,
      location: {
        name: w.locationName || `${w.latitude.toFixed(2)}, ${w.longitude.toFixed(2)}`,
        latitude: w.latitude,
        longitude: w.longitude,
      },
      unit: w.unit,
      ...(current
        ? {
            current: {
              temperature: current.temperature_2m ?? 0,
              apparent: current.apparent_temperature ?? current.temperature_2m ?? 0,
              weatherCode: current.weather_code ?? 0,
              label: wmoLabel(current.weather_code ?? 0, "de"),
              icon: wmoIcon(current.weather_code ?? 0, isDay),
              isDay,
              windSpeed: current.wind_speed_10m ?? 0,
              windDirection: current.wind_direction_10m ?? 0,
              ...(current.relative_humidity_2m !== undefined
                ? { humidity: current.relative_humidity_2m }
                : {}),
            },
          }
        : {}),
      ...(daily?.time
        ? {
            daily: daily.time.map((dateStr, i): WeatherDailyEntry => {
              const code = daily.weather_code?.[i] ?? 0;
              return {
                date: dateStr,
                weatherCode: code,
                icon: wmoIcon(code, true),
                label: wmoLabel(code, "de"),
                tempMax: daily.temperature_2m_max?.[i] ?? 0,
                tempMin: daily.temperature_2m_min?.[i] ?? 0,
                precipProbabilityMax: daily.precipitation_probability_max?.[i] ?? 0,
                sunrise: daily.sunrise?.[i] ?? "",
                sunset: daily.sunset?.[i] ?? "",
              };
            }),
          }
        : {}),
    };

    cache().set(key, { data, fetchedAt: now });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({
      configured: true,
      online: false,
      error: err instanceof Error ? err.message : "Open-Meteo Fehler",
    });
  }
}
