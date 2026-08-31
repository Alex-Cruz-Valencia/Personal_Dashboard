/**
 * Timezone-aware helpers for turning real timestamps into the "decimal hour of
 * the local day" scale the dashboard runs on.
 *
 * All of this uses `Intl.DateTimeFormat` with an explicit `timeZone` so the
 * server's own timezone never leaks into the numbers.
 */

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function partsInZone(date: Date, timeZone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  // Intl can emit "24" for midnight in some engines — normalise to 0.
  const hour = Number(map.hour) % 24;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Decimal hour of the local day, e.g. 8:12am → 8.2. */
export function decimalHourInZone(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  return p.hour + p.minute / 60 + p.second / 3600;
}

/** ISO date (YYYY-MM-DD) for `date` in the given zone. */
export function isoDateInZone(date: Date, timeZone: string): string {
  const p = partsInZone(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * Decimal hour for an absolute timestamp, relative to `referenceDay` in the
 * given zone. Events before the reference day clamp to 0, after clamp to 24 —
 * the arc only shows a single day.
 */
export function decimalHourForTimestamp(
  timestamp: string | Date,
  referenceDay: string,
  timeZone: string,
): number {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const p = partsInZone(date, timeZone);
  const day = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  if (day < referenceDay) return 0;
  if (day > referenceDay) return 24;
  return p.hour + p.minute / 60 + p.second / 3600;
}

/** Start and end of `referenceDay` (local) as absolute ISO timestamps. */
export function dayBoundsUtc(
  referenceDay: string,
  timeZone: string,
): { timeMin: string; timeMax: string } {
  // Find the UTC instant that reads as 00:00:00 on referenceDay in timeZone by
  // measuring the zone's offset at noon that day (avoids DST edge cases).
  const noonGuess = new Date(`${referenceDay}T12:00:00Z`);
  const p = partsInZone(noonGuess, timeZone);
  const asUtcNoon = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const offsetMs = asUtcNoon - noonGuess.getTime();
  const localMidnight = new Date(`${referenceDay}T00:00:00Z`).getTime() - offsetMs;
  return {
    timeMin: new Date(localMidnight).toISOString(),
    timeMax: new Date(localMidnight + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/** Relative age string like the mock data: "18h", "1d", "3d", "just now". */
export function relativeAge(from: string | Date, now: Date = new Date()): string {
  const then = typeof from === "string" ? new Date(from) : from;
  const mins = Math.max(0, Math.round((now.getTime() - then.getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
