/**
 * The week strip's logic — pure except `fetchWeekAgendas`, which only calls
 * the existing per-day agenda reader. Times are decimal hours, like everywhere.
 */

import { getWeekAgendas } from "./google/calendar";
import { DEFAULT_TASK_MINUTES } from "./plan";
import type { AgendaEvent, WeekDay, WeekTask } from "./types";

/** Booked hours + estimated task time at or past this reads as a heavy day. */
export const HEAVY_HOURS = 6;
/** Events this long are all-day banners, not booked time. */
const ALL_DAY_HOURS = 12;

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Merged duration of timed events, in hours (overlaps counted once). */
export function bookedHours(events: AgendaEvent[]): number {
  const spans = events
    .filter((e) => e.end - e.start < ALL_DAY_HOURS && e.end > e.start)
    .map((e) => [e.start, e.end] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const [s, e] of spans) {
    if (cur && s <= cur[1]) cur[1] = Math.max(cur[1], e);
    else {
      if (cur) total += cur[1] - cur[0];
      cur = [s, e];
    }
  }
  if (cur) total += cur[1] - cur[0];
  return total;
}

export function isHeavy(booked: number | null, tasksDue: number | null): boolean {
  const load = (booked ?? 0) + ((tasksDue ?? 0) * DEFAULT_TASK_MINUTES) / 60;
  return load >= HEAVY_HOURS;
}

/**
 * Agendas for the six days after `todayIso`, from one request per calendar. If
 * the read fails, every day is null (the strip shows "No calendar") rather than
 * the page failing.
 */
export async function fetchWeekAgendas(
  todayIso: string,
  timezone: string,
): Promise<(AgendaEvent[] | null)[]> {
  const days = [1, 2, 3, 4, 5, 6].map((n) => addDays(todayIso, n));
  try {
    return await getWeekAgendas(days, timezone);
  } catch {
    return days.map(() => null);
  }
}

export function buildWeek(input: {
  todayIso: string;
  todayAgenda: AgendaEvent[] | null;
  laterAgendas: (AgendaEvent[] | null)[] | null;
  /** Tasks due on each later day, keyed by ISO date. */
  weekTasks: Record<string, WeekTask[]> | null;
  /** Tasks due today that aren't overdue (from the already-fetched list). */
  todayTasks: WeekTask[] | null;
}): WeekDay[] {
  const { todayIso, todayAgenda, laterAgendas, weekTasks, todayTasks } = input;
  return [0, 1, 2, 3, 4, 5, 6].map((n) => {
    const iso = addDays(todayIso, n);
    const events = n === 0 ? todayAgenda : (laterAgendas?.[n - 1] ?? null);
    const tasks = n === 0 ? todayTasks : weekTasks ? (weekTasks[iso] ?? []) : null;
    const tasksDue = tasks ? tasks.length : null;
    const booked = events ? bookedHours(events) : null;
    const at = new Date(`${iso}T12:00:00Z`);
    return {
      iso,
      name: at.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      date: String(at.getUTCDate()),
      isToday: n === 0,
      bookedHours: booked,
      eventCount: events ? events.filter((e) => e.end - e.start < ALL_DAY_HOURS).length : null,
      tasksDue,
      heavy: isHeavy(booked, tasksDue),
      events: events
        ? events.map((e) => ({ id: e.id, name: e.name, start: e.start, end: e.end, kind: e.kind, color: e.color }))
        : null,
      tasks,
    };
  });
}
