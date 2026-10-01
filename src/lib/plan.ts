/**
 * The "Plan" card's logic — pure, so it runs the same on server and client.
 *
 * Takes today's calendar + Todoist tasks and answers two questions:
 * - what's up next (or happening now), and
 * - where are today's open gaps, and which tasks would fit in them.
 *
 * Times are decimal hours in the viewer's local day, like everywhere else.
 */

import type { AgendaEvent, Priority, Task } from "./types";

/** Gaps shorter than this aren't worth planning into. */
export const MIN_GAP_MINUTES = 20;
/** Assumed length of a task that has no Todoist duration set. */
export const DEFAULT_TASK_MINUTES = 30;
/** At most this many suggestions per gap — a nudge, not a to-do dump. */
const MAX_PER_GAP = 3;
/** Slots start on a 5-minute grid. */
const GRID = 5 / 60;

/**
 * Marker written into a blocked event's description, so a task that's
 * already on the calendar isn't suggested again.
 */
export function taskMarker(taskId: string): string {
  return `[todoist:${taskId}]`;
}

/**
 * The countdown at the top of the card. Deliberately name-free — the day arc
 * already says WHAT; this only says WHEN.
 */
export interface Countdown {
  /** "now" = inside an event (minutes left); "next" = minutes until the next one. */
  mode: "now" | "next";
  minutes: number;
  /** How full the ring is, 0–1: share of the current event left, or of the last hour before the next. */
  fraction: number;
  event: AgendaEvent;
  /** While inside an event: minutes until the one after it, if any. */
  thenMinutes?: number;
}

export interface Suggestion {
  task: Task;
  minutes: number;
}

export interface OpenGap {
  start: number;
  end: number;
  minutes: number;
  /** Tasks that fit this gap, best first. "Block" puts one at `start`. */
  suggestions: Suggestion[];
}

/** A task already put on today's calendar from here (its event carries the marker). */
export interface ScheduledTask {
  task: Task;
  event: AgendaEvent;
}

export interface Plan {
  countdown: Countdown | null;
  gaps: OpenGap[];
  scheduled: ScheduledTask[];
  /** Total plannable free time left today, in minutes. */
  freeMinutes: number;
  /** True once the planning window (now → dayEnd) is empty. */
  dayOver: boolean;
}

export function taskMinutes(t: Pick<Task, "durationMinutes">): number {
  return t.durationMinutes && t.durationMinutes > 0 ? t.durationMinutes : DEFAULT_TASK_MINUTES;
}

const PRIORITY_RANK: Record<Priority, number> = { 1: 0, 2: 1, 3: 2 };

/**
 * Tasks worth planning, best first: no clock time of their own (those are
 * already scheduled), not already blocked on the calendar, not skipped.
 * Ordered by priority, then nearest deadline, then their Todoist order.
 */
export function plannableTasks(
  tasks: Task[],
  agenda: AgendaEvent[],
  skipped: ReadonlySet<string> = new Set(),
): Task[] {
  const blockedText = agenda.map((e) => `${e.description ?? ""}`).join("\n");
  const eventNames = new Set(agenda.map((e) => e.name.trim().toLowerCase()));
  return tasks
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.id && t.dueHour == null && !skipped.has(t.id))
    .filter(({ t }) => !blockedText.includes(taskMarker(t.id!)))
    .filter(({ t }) => !eventNames.has(t.name.trim().toLowerCase()))
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.t.priority] - PRIORITY_RANK[b.t.priority] ||
        (a.t.deadline ?? "9999").localeCompare(b.t.deadline ?? "9999") ||
        a.i - b.i,
    )
    .map(({ t }) => t);
}

/** Busy intervals clipped to [from, to], merged, sorted. */
function busy(agenda: AgendaEvent[], from: number, to: number): [number, number][] {
  const spans = agenda
    .map((e) => [Math.max(e.start, from), Math.min(e.end, to)] as [number, number])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [s, e] of spans) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

const ceilToGrid = (h: number) => Math.ceil(h / GRID - 1e-9) * GRID;
const floorToGrid = (h: number) => Math.floor(h / GRID + 1e-9) * GRID;

export function buildPlan(
  agenda: AgendaEvent[],
  tasks: Task[],
  nowHour: number,
  dayEnd: number,
  skipped: ReadonlySet<string> = new Set(),
): Plan {
  // Countdown: inside an event → time left in it; otherwise → time until the
  // next one. The ring drains over the event / over the final hour.
  const running = agenda.find((e) => e.start <= nowHour && e.end > nowHour);
  const next = agenda.find((e) => e.start > nowHour);
  let countdown: Countdown | null = null;
  if (running) {
    const minutes = Math.max(1, Math.round((running.end - nowHour) * 60));
    const after = agenda.find((e) => e.start >= running.end);
    countdown = {
      mode: "now",
      minutes,
      fraction: (running.end - nowHour) / (running.end - running.start),
      event: running,
      thenMinutes: after ? Math.round((after.start - nowHour) * 60) : undefined,
    };
  } else if (next) {
    const minutes = Math.max(1, Math.round((next.start - nowHour) * 60));
    countdown = { mode: "next", minutes, fraction: Math.min(1, minutes / 60), event: next };
  }

  // Open gaps between now and the end of the day. A gap that's already
  // under way starts "now" (rounded up to the 5-minute grid).
  const from = ceilToGrid(nowHour);
  const dayOver = from >= dayEnd;
  const gaps: OpenGap[] = [];
  let cursor = from;
  for (const [s, e] of [...busy(agenda, from, dayEnd), [dayEnd, dayEnd] as [number, number]]) {
    const gapEnd = floorToGrid(s);
    const minutes = Math.round((gapEnd - cursor) * 60);
    if (minutes >= MIN_GAP_MINUTES) gaps.push({ start: cursor, end: gapEnd, minutes, suggestions: [] });
    cursor = Math.max(cursor, ceilToGrid(e));
  }

  // Each task is suggested once, in the first gap long enough for it.
  const pool = plannableTasks(tasks, agenda, skipped);
  for (const gap of gaps) {
    for (let i = 0; i < pool.length && gap.suggestions.length < MAX_PER_GAP; ) {
      const minutes = taskMinutes(pool[i]);
      if (minutes <= gap.minutes) {
        gap.suggestions.push({ task: pool[i], minutes });
        pool.splice(i, 1);
      } else i++;
    }
  }

  const scheduled = tasks.flatMap((task) => {
    if (!task.id) return [];
    const event = agenda.find((e) => e.description?.includes(taskMarker(task.id!)));
    return event ? [{ task, event }] : [];
  });

  return {
    countdown,
    gaps,
    scheduled,
    freeMinutes: gaps.reduce((sum, g) => sum + g.minutes, 0),
    dayOver,
  };
}

/** 25 → "25 min"; 80 → "1h 20m"; 120 → "2h". */
export function minutesLabel(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}
