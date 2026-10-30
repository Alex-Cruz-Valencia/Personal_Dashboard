import type { Sky } from "@/lib/types";

/** WMO weather interpretation codes → short human phrases (Open-Meteo). */
const WMO: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Violent showers",
  85: "Light snow showers",
  86: "Snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Severe thunderstorm with hail",
};

export function weatherCodeToText(code: number): string {
  return WMO[code] ?? "Unsettled";
}

const COMPASS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

export function degreesToCompass(deg: number): string {
  return COMPASS[Math.round(((deg % 360) / 22.5)) % 16];
}

/** WMO code → what the ambient scene should draw. */
export function weatherCodeToSky(code: number): Sky["kind"] {
  if (code === 0 || code === 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "cloudy";
}

const SKY_KINDS: readonly Sky["kind"][] = ["clear", "partly", "cloudy", "fog", "drizzle", "rain", "storm", "snow"];

/**
 * `/?sky=rain&wind=20` previews the ambient scene without waiting for weather.
 * Only the animation changes; the temperature and condition text stay real.
 */
export function parseSkyPreview(sp: Record<string, string | string[] | undefined>): Sky | null {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const kind = SKY_KINDS.find((k) => k === one(sp.sky));
  if (!kind) return null;
  const wind = Number(one(sp.wind));
  return { kind, windMph: Number.isFinite(wind) && wind >= 0 && wind <= 99 ? wind : 5 };
}
