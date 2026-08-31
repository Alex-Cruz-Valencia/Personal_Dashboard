/**
 * Where the dashboard thinks you are right now.
 *
 * Resolution order:
 *   1. `?lat=&lon=&tz=` query params (explicit override / testing)
 *   2. the device's last shared position (cookie set by `POST /api/location`,
 *      driven by the browser Geolocation API in `LocationSync`)
 *   3. `DASHBOARD_LATITUDE` / `DASHBOARD_LONGITUDE` / `DASHBOARD_TIMEZONE`
 *   4. the built-in default (San Francisco)
 *
 * Weather, daylight, "now", the greeting and every event/task time key off
 * `timezone`, so moving between Hanover and Salinas just works once the
 * device has been allowed to share location.
 */

import "server-only";
import { cookies } from "next/headers";
import { config } from "./config";

export const LOCATION_COOKIE = "gdash_loc";

export interface ResolvedLocation {
  latitude: number;
  longitude: number;
  timezone: string;
  source: "query" | "device" | "env" | "default";
  /** Optional human label, e.g. a city name, when the device sent one. */
  label?: string;
}

export interface LocationOverride {
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

interface StoredLocation {
  lat: number;
  lon: number;
  tz?: string;
  label?: string;
}

function validLatLon(lat: unknown, lon: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}

function validTimezone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function parseLocationOverride(
  searchParams: Record<string, string | string[] | undefined>,
): LocationOverride {
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const lat = Number(one(searchParams.lat));
  const lon = Number(one(searchParams.lon));
  const tz = one(searchParams.tz);
  const out: LocationOverride = {};
  if (validLatLon(lat, lon)) {
    out.latitude = lat;
    out.longitude = lon;
  }
  if (validTimezone(tz)) out.timezone = tz;
  return out;
}

export async function resolveLocation(
  override?: LocationOverride,
): Promise<ResolvedLocation> {
  const fallbackTz = config.timezone;

  if (override && validLatLon(override.latitude, override.longitude)) {
    return {
      latitude: override.latitude,
      longitude: override.longitude as number,
      timezone: validTimezone(override.timezone) ? override.timezone : fallbackTz,
      source: "query",
    };
  }

  const raw = (await cookies()).get(LOCATION_COOKIE)?.value;
  if (raw) {
    try {
      const stored = JSON.parse(raw) as StoredLocation;
      if (validLatLon(stored.lat, stored.lon)) {
        return {
          latitude: stored.lat,
          longitude: stored.lon,
          timezone: validTimezone(stored.tz) ? stored.tz : fallbackTz,
          source: "device",
          label: typeof stored.label === "string" ? stored.label : undefined,
        };
      }
    } catch {
      /* fall through */
    }
  }

  return {
    latitude: config.latitude,
    longitude: config.longitude,
    timezone: fallbackTz,
    source: config.hasExplicitLocation ? "env" : "default",
  };
}

/** Serialise for the cookie `POST /api/location` writes. */
export function serializeStoredLocation(input: {
  latitude: number;
  longitude: number;
  timezone?: string;
  label?: string;
}): string {
  const payload: StoredLocation = {
    // ~1 km precision is plenty for weather and keeps the stored point coarse
    lat: Math.round(input.latitude * 100) / 100,
    lon: Math.round(input.longitude * 100) / 100,
  };
  if (validTimezone(input.timezone)) payload.tz = input.timezone;
  if (typeof input.label === "string" && input.label.trim()) {
    payload.label = input.label.trim().slice(0, 80);
  }
  return JSON.stringify(payload);
}

export { validLatLon, validTimezone };
