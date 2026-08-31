/**
 * Phase 2 — Weather via Open-Meteo (https://open-meteo.com).
 *
 * No API key required. Location, timezone and units come from `config`.
 */

import "server-only";
import { config } from "@/lib/config";
import type { Weather } from "@/lib/types";
import { degreesToCompass, weatherCodeToText } from "./codes";

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
  };
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
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

export async function getWeather(): Promise<Weather> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(config.latitude));
  url.searchParams.set("longitude", String(config.longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,weather_code,wind_speed_10m,wind_direction_10m",
  );
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max",
  );
  url.searchParams.set("timezone", config.timezone);
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

  return {
    tempNow: Math.round(data.current.temperature_2m),
    tempHigh: Math.round(data.daily.temperature_2m_max[0]),
    tempLow: Math.round(data.daily.temperature_2m_min[0]),
    condition,
    sunrise: isoLocalToDecimalHour(data.daily.sunrise[0]),
    sunset: isoLocalToDecimalHour(data.daily.sunset[0]),
    footnote: `${rainPhrase} · Wind ${wind} mph ${dir}`,
  };
}
