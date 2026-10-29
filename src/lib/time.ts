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

/** The UTC instant that reads as 00:00 on `day` in `timeZone`. */
function localMidnightUtc(day: string, timeZone: string): number {
  const wall = Date.parse(`${day}T00:00:00Z`);
  // The zone's offset at a given instant, from how that instant reads there.
  const offsetAt = (t: number) => {
    const p = partsInZone(new Date(t), timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - t;
  };
  // Guess with the offset at wall-clock midnight read as UTC, then correct once
  // with the offset at the guess: that lands on the right side of a DST change
  // (a noon-based offset is an hour off at midnight on change days).
  const guess = wall - offsetAt(wall);
  return wall - offsetAt(guess);
}

/**
 * Start and end of `referenceDay` (local) as absolute ISO timestamps. A DST
 * day is 23 or 25 hours long, so the end is the next day's midnight, not
 * start + 24h.
 */
export function dayBoundsUtc(
  referenceDay: string,
  timeZone: string,
): { timeMin: string; timeMax: string } {
  const next = new Date(`${referenceDay}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    timeMin: new Date(localMidnightUtc(referenceDay, timeZone)).toISOString(),
    timeMax: new Date(localMidnightUtc(next.toISOString().slice(0, 10), timeZone)).toISOString(),
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
