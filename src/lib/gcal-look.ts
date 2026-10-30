/**
 * Google Calendar's way of drawing a day, for the "Google" calendar look. Pure and
 * server/client-safe.
 */

/** "8 AM", Google's hour label (24-hour keeps the usual "08:00" style via the caller). */
export function hourLabel(h: number): string {
  const hh = Math.floor(h) % 24;
  return `${hh % 12 === 0 ? 12 : hh % 12} ${hh < 12 ? "AM" : "PM"}`;
}

function clock(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${hh % 12 === 0 ? 12 : hh % 12}${mm ? `:${String(mm).padStart(2, "0")}` : ""}`;
}
const meridian = (h: number) => (Math.floor(h) % 24 < 12 ? "am" : "pm");

/** "9:15am", or "9am" on the hour. */
export function shortTime(h: number): string {
  return `${clock(h)}${meridian(h)}`;
}

/** "10:10 – 11:15am"; the first am/pm only shows when the two differ, as Google does. */
export function shortSpan(start: number, end: number): string {
  return `${clock(start)}${meridian(start) === meridian(end) ? "" : meridian(start)} – ${clock(end)}${meridian(end)}`;
}

/**
 * Overlapping events as a cascade, not strict columns: each starts further right and the
 * earlier ones run on underneath, so a block keeps enough width to read. Percentages of the column.
 */
export function cascade(lane: number, lanes: number): { left: number; width: number; z: number } {
  if (lanes <= 1) return { left: 0, width: 100, z: 1 };
  const step = 100 / lanes;
  const left = lane * step;
  return { left, width: lane === lanes - 1 ? 100 - left : Math.min(100 - left, step * 1.7), z: lane + 1 };
}
