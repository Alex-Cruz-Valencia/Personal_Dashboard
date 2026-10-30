/**
 * Phase 2 — Weather via Open-Meteo (https://open-meteo.com).
 *
 * No API key required. Location + timezone are passed in (see `location.ts`).
 * `place` is left empty here — the orchestrator fills it from reverse geocoding.
 */

import "server-only";
import { formatHour } from "@/lib/format";
import type { HourlyTemp, Weather } from "@/lib/types";
import { degreesToCompass, weatherCodeToSky, weatherCodeToText } from "./codes";

export interface WeatherLocation {
  latitude: number;
  longitude: number;
  timezone: string;
}

interface OpenMeteoResponse {
  /** Not in the response; filled from `current.time` below. */
  current_time?: string;
  current: {
    time?: string;
    temperature_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    apparent_temperature?: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    precipitation_probability: number[];
    wind_speed_10m: number[];
    uv_index: number[];
  };
  daily: {
    sunrise: string[];
    sunset: string[];
    precipitation_probability_max: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    weather_code?: number[];
  };
}

/** "2026-08-29T06:24" (local, no zone) → 6.4 decimal hours. */
function isoLocalToDecimalHour(value: string): number {
  const time = value.split("T")[1] ?? "00:00";
  const [h, m] = time.split(":").map(Number);
  return h + (m || 0) / 60;
}

/** The one thing worth knowing at `hour`. */
function hourNote(
  code: number,
  uv: number | undefined,
  precip: number | undefined,
  wind: number | undefined,
  hour: number,
  sunrise: number,
  sunset: number,
  use24: boolean,
): string {
  const base = weatherCodeToText(code);
  if (hour === Math.round(sunrise)) {
    return `${base} · sunrise ${formatHour(sunrise, use24)}`;
  }
  if (hour === Math.round(sunset)) {
    return `${base} · sunset ${formatHour(sunset, use24)}`;
  }
  if (precip != null && precip >= 40) return `${base} · ${precip}% rain`;
  if (wind != null && Math.round(wind) >= 14) {
    return `${base} · breezy ${Math.round(wind)} mph`;
  }
  if (uv != null && uv >= 7) return `${base} · UV ${Math.round(uv)}`;
  return base;
}

function buildHourly(
  data: OpenMeteoResponse,
  arcFrom: number,
  arcTo: number,
  sunrise: number,
  sunset: number,
): HourlyTemp[] {
  const { time } = data.hourly;
  const out: HourlyTemp[] = [];
  for (let h = Math.floor(arcFrom); h <= Math.ceil(arcTo); h++) {
    const i = time.findIndex(
      (t) => Number(t.split("T")[1]?.split(":")[0]) === h,
    );
    if (i === -1) continue;
    out.push({
      h,
      t: Math.round(data.hourly.temperature_2m[i]),
      note: hourNote(
        data.hourly.weather_code[i],
        data.hourly.uv_index?.[i],
        data.hourly.precipitation_probability?.[i],
        data.hourly.wind_speed_10m?.[i],
        h,
        sunrise,
        sunset,
        false,
      ),
    });
  }
  return out;
}

/** What's left of today, hour by hour: the next rainy stretch, the windiest hour, the UV peak. */
function restOfToday(data: OpenMeteoResponse, nowHour: number) {
  const today = data.hourly.time[0]?.slice(0, 10);
  const hours = data.hourly.time
    .map((t, i) => ({ h: isoLocalToDecimalHour(t), day: t.slice(0, 10), i }))
    .filter((x) => x.day === today && x.h + 1 > nowHour);
  let rain: { start: number; end: number; chance: number } | null = null;
  for (const { h, i } of hours) {
    const p = data.hourly.precipitation_probability?.[i] ?? 0;
    if (p >= 40) {
      if (!rain) rain = { start: Math.max(h, nowHour), end: h + 1, chance: p };
      else if (rain.end === h) rain = { start: rain.start, end: h + 1, chance: Math.max(rain.chance, p) };
    } else if (rain) break;
  }
  const rainWindow: Weather["rainWindow"] = rain;
  let windPeak: Weather["windPeak"];
  let uvPeak: Weather["uvPeak"] = null;
  for (const { h, i } of hours) {
    const w = data.hourly.wind_speed_10m?.[i] ?? 0;
    if (!windPeak || w > windPeak.mph) windPeak = { mph: Math.round(w), at: h };
    const uv = data.hourly.uv_index?.[i] ?? 0;
    if (uv >= 6 && (!uvPeak || uv > uvPeak.index)) uvPeak = { index: Math.round(uv), at: h };
  }
  return { rainWindow, windPeak, uvPeak };
}

export async function getWeather(
  location: WeatherLocation,
  arc: { from: number; to: number } = { from: 6, to: 22 },
): Promise<Weather> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,apparent_temperature",
  );
  url.searchParams.set(
    "hourly",
    "temperature_2m,weather_code,precipitation_probability,wind_speed_10m,uv_index",
  );
  url.searchParams.set(
    "daily",
    "sunrise,sunset,precipitation_probability_max,temperature_2m_max,temperature_2m_min,weather_code",
  );
  url.searchParams.set("timezone", location.timezone);
  // Two days: tomorrow's line on the briefing card. Everything else reads day 0.
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");

  const res = await fetch(url, { next: { revalidate: 900 }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(`Open-Meteo responded ${res.status}`);
  }
  const data = (await res.json()) as OpenMeteoResponse;
  data.current_time = data.current.time;

  const condition = weatherCodeToText(data.current.weather_code);
  const wind = Math.round(data.current.wind_speed_10m);
  const dir = degreesToCompass(data.current.wind_direction_10m);
  const rainChance = data.daily.precipitation_probability_max[0] ?? 0;
  const rainPhrase =
    rainChance >= 30 ? `${rainChance}% chance of rain` : "No rain expected";
  const sunrise = isoLocalToDecimalHour(data.daily.sunrise[0]);
  const sunset = isoLocalToDecimalHour(data.daily.sunset[0]);

  const nowHour = isoLocalToDecimalHour(data.current_time ?? "") || new Date().getHours();
  const d = data.daily;
  const tomorrow =
    d.temperature_2m_max?.[1] != null && d.temperature_2m_min?.[1] != null
      ? {
          high: Math.round(d.temperature_2m_max[1]),
          low: Math.round(d.temperature_2m_min[1]),
          condition: weatherCodeToText(d.weather_code?.[1] ?? 0),
          rainChance: d.precipitation_probability_max[1] ?? 0,
        }
      : undefined;

  return {
    ...restOfToday(data, nowHour),
    high: d.temperature_2m_max?.[0] != null ? Math.round(d.temperature_2m_max[0]) : undefined,
    low: d.temperature_2m_min?.[0] != null ? Math.round(d.temperature_2m_min[0]) : undefined,
    feelsLike: data.current.apparent_temperature != null ? Math.round(data.current.apparent_temperature) : undefined,
    rainChance,
    tomorrow,
    place: "",
    tempNow: Math.round(data.current.temperature_2m),
    condition,
    sunrise,
    sunset,
    footnote: `${rainPhrase} · Wind ${wind} mph ${dir}`,
    sky: { kind: weatherCodeToSky(data.current.weather_code), windMph: wind },
    hourly: buildHourly(data, arc.from, arc.to, sunrise, sunset),
  };
}
