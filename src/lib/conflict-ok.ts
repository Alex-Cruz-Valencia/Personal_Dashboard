/**
 * Keys for conflicts and tight turnarounds marked "It's fine". Pure, so the
 * route, the store and the strip agree on what a key looks like. A key is
 * `conflict|<day>|<event>@<start>-<end>|<event>@<start>-<end>` (see `pairKey`
 * in `attention.ts`); the day ties it to today, so a repeat tomorrow warns again.
 */

const KEY_RE = /^(conflict|tight)\|(\d{4}-\d{2}-\d{2})\|[^\n\r]{3,600}$/;
/** Plenty for one day; a runaway client can't grow the store without bound. */
export const MAX_OK_PER_DAY = 200;

/** The day a well-formed key belongs to, or null for anything else. */
export function okKeyDay(key: unknown): string | null {
  if (typeof key !== "string") return null;
  const m = KEY_RE.exec(key);
  return m ? m[2] : null;
}

/** Today's keys from a stored list: well-formed, deduplicated, capped. */
export function keysForDay(keys: unknown, day: string): string[] {
  if (!Array.isArray(keys)) return [];
  return [...new Set(keys.filter((k): k is string => okKeyDay(k) === day))].slice(0, MAX_OK_PER_DAY);
}
