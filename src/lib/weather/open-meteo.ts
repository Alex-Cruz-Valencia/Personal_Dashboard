/**
 * Phase 2 — Weather via Open-Meteo (https://open-meteo.com).
 *
 * No API key required. Location + timezone are passed in (see `location.ts`).
 * `place` is left empty here — the orchestrator fills it from reverse geocoding.
 */

import "server-only";
import { formatHour } from "@/lib/format";
import type { HourlyTemp, Weather } from "@/lib/types";
import { degreesToCompass, weatherCodeToText } from "./codes";

export interface WeatherLocation {
  latitude: number;
  longitude: number;
  timezone: string;
}

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
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

export async function getWeather(
  location: WeatherLocation,
  arc: { from: number; to: number } = { from: 6, to: 22 },
): Promise<Weather> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,weather_code,wind_speed_10m,wind_direction_10m",
  );
  url.searchParams.set(
    "hourly",
    "temperature_2m,weather_code,precipitation_probability,wind_speed_10m,uv_index",
  );
  url.searchParams.set(
    "daily",
    "sunrise,sunset,precipitation_probability_max",
  );
  url.searchParams.set("timezone", location.timezone);
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");

  const res = await fetch(url, { next: { revalidate: 900 } });
  if (!res.ok) {
    throw new Error(`Open-Meteo responded ${res.status}`);
  }
  const data = (await res.json()) as OpenMeteoResponse;

  const condition = weatherCodeToText(data.current.weather_code);
  const wind = Math.round(data.current.wind_speed_10m);
  const dir = degreesToCompass(data.current.wind_direction_10m);
  const rainChance = data.daily.precipitation_probability_max[0] ?? 0;
  const rainPhrase =
    rainChance >= 30 ? `${rainChance}% chance of rain` : "No rain expected";
  const sunrise = isoLocalToDecimalHour(data.daily.sunrise[0]);
  const sunset = isoLocalToDecimalHour(data.daily.sunset[0]);

  return {
    place: "",
    tempNow: Math.round(data.current.temperature_2m),
    condition,
    sunrise,
    sunset,
    footnote: `${rainPhrase} · Wind ${wind} mph ${dir}`,
    hourly: buildHourly(data, arc.from, arc.to, sunrise, sunset),
  };
}
