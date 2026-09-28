/**
 * Pure view-model helpers.
 *
 * These are a direct port of the derivations in the Claude Design source
 * ("Morning Dashboard v2.dc.html" → `renderVals()`). Keeping them here means
 * every card stays a thin presentational component that just maps over a
 * typed prop.
 */

import type { Density } from "./settings";
import type {
  AgendaEvent,
  ArcWindow,
  Priority,
  Reply,
  Task,
} from "./types";

export const PRIORITY_LABEL: Record<Priority, string> = {
  1: "Urgent",
  2: "Normal",
  3: "Someday",
};

/** Decimal hour → clock string. `fmt()` in the source. */
export function formatHour(h: number, use24: boolean): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const m = String(mm).padStart(2, "0");
  if (use24) return `${String(hh).padStart(2, "0")}:${m}`;
  const ampm = hh >= 12 ? "pm" : "am";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${m}${ampm}`;
}

/** Position of an hour within the arc window, clamped to 0–100. `pct()`. */
export function arcPct(h: number, arc: ArcWindow): number {
  return Math.max(0, Math.min(100, ((h - arc.from) / (arc.to - arc.from)) * 100));
}

export function greetingFor(h: number, name: string): string {
  if (h < 5) return `Still up, ${name}?`;
  if (h < 12) return `Good morning, ${name}.`;
  if (h < 18) return `Good afternoon, ${name}.`;
  return `Good evening, ${name}.`;
}

export function dateLineFor(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/* ---------- tasks ---------- */

export interface TaskVM extends Task {
  priorityLabel: string;
  tagCls: string;
  cls: string;
}

export function buildTasks(tasks: Task[], density: Density): TaskVM[] {
  return tasks
    .filter((t) => (density === "comfortable" ? true : t.priority < 3))
    .map((t) => ({
      ...t,
      priorityLabel: PRIORITY_LABEL[t.priority],
      tagCls: `task__tag task__tag--p${t.priority}`,
      cls: `task task--p${t.priority}`,
    }));
}

export function taskCountLabel(tasks: TaskVM[]): string {
  const urgent = tasks.filter((t) => t.priority === 1).length;
  return `${urgent} urgent · ${tasks.length} total`;
}

/* ---------- agenda ---------- */

export interface AgendaVM {
  name: string;
  where: string;
  start: string;
  duration: string;
  cls: string;
}

export function buildAgenda(
  agenda: AgendaEvent[],
  nowHour: number,
  use24: boolean,
): AgendaVM[] {
  return agenda.map((e) => ({
    name: e.name,
    where: e.where,
    start: formatHour(e.start, use24),
    duration: `${Math.round((e.end - e.start) * 60)} min`,
    cls:
      `event event--${e.kind}` +
      (nowHour >= e.start && nowHour < e.end ? " event--now" : ""),
  }));
}

export function agendaCountLabel(agenda: AgendaEvent[]): string {
  return `${agenda.length} blocks`;
}

/* ---------- the day arc ---------- */

export interface ArcEventVM {
  label: string;
  timeLabel: string;
  left: string;
  width: string;
  cls: string;
}

export function buildArcEvents(
  agenda: AgendaEvent[],
  arc: ArcWindow,
  use24: boolean,
): ArcEventVM[] {
  return agenda.map((e) => {
    // The label stays INSIDE the block wherever it can: full at ≥10%,
    // compact (small, wrapped, no time) down to 6%, and only below that
    // does it move outside the band.
    const w = Math.max(0.7, arcPct(e.end, arc) - arcPct(e.start, arc));
    const compact = w < 10 && w >= 6;
    const tight = w < 6;
    return {
      label: e.name,
      timeLabel: formatHour(e.start, use24),
      left: arcPct(e.start, arc).toFixed(2),
      width: w.toFixed(2),
      cls:
        `arc__event arc__event--${e.kind}` +
        (compact ? " arc__event--compact" : "") +
        (tight ? " arc__event--tight" : ""),
    };
  });
}

export function buildHourLines(arc: ArcWindow): { left: string }[] {
  const lines: { left: string }[] = [];
  for (let h = arc.from + 1; h < arc.to; h++) {
    lines.push({ left: arcPct(h, arc).toFixed(2) });
  }
  return lines;
}

export function buildScaleLabels(
  arc: ArcWindow,
  use24: boolean,
): { left: string; label: string }[] {
  const labels: { left: string; label: string }[] = [];
  for (let h = arc.from; h <= arc.to; h += 2) {
    labels.push({
      left: arcPct(h, arc).toFixed(2),
      label: formatHour(h, use24).replace(":00", ""),
    });
  }
  return labels;
}

export function buildArcTasks(
  tasks: Task[],
  arc: ArcWindow,
): { left: string }[] {
  return tasks
    .filter((t) => t.dueHour != null)
    .map((t) => ({ left: arcPct(t.dueHour as number, arc).toFixed(2) }));
}

export function arcRangeLabel(arc: ArcWindow, use24: boolean): string {
  return `${formatHour(arc.from, use24)} – ${formatHour(arc.to, use24)}`;
}

/* ---------- replies ---------- */

export interface ReplyVM extends Reply {
  initials: string;
  noteCls: string;
}

export function buildReplies(replies: Reply[]): ReplyVM[] {
  return replies.map((r) => ({
    ...r,
    initials: r.from
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2),
    noteCls: `reply__note reply__note--u${r.urgency}`,
  }));
}

export function replyCountLabel(replies: Reply[]): string {
  return `${replies.length} waiting`;
}

/* ---------- footline ---------- */

export function footLeft(agenda: AgendaEvent[], nowHour: number): string {
  const firstMeeting = agenda.find(
    (e) => e.kind === "meeting" && e.start > nowHour,
  );
  if (!firstMeeting) return "Next block is already underway";
  const freeMins = Math.round((firstMeeting.start - nowHour) * 60);
  return `${Math.floor(freeMins / 60)}h ${freeMins % 60}m clear before “${firstMeeting.name}”`;
}

export function footRight(nowHour: number, use24: boolean): string {
  return `Refreshed ${formatHour(nowHour, use24)}`;
}
