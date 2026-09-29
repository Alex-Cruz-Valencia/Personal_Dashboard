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

/**
 * Decimal hour → clock string. `fmt()` in the source.
 *
 * `h` can run past 24 (a day-end of "midnight" is the literal value 24, not
 * 0, so the arc's scale stays linear) — `hh % 24` puts it back on a normal
 * clock face before formatting, so 24 reads as 12:00am rather than colliding
 * with noon's "12:00pm".
 */
export function formatHour(h: number, use24: boolean): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const m = String(mm).padStart(2, "0");
  if (use24) return `${String(hh % 24).padStart(2, "0")}:${m}`;
  const clock = hh % 24;
  const ampm = clock >= 12 ? "pm" : "am";
  const h12 = clock % 12 === 0 ? 12 : clock % 12;
  return `${h12}:${m}${ampm}`;
}

/** Decimal hour → "HH:MM" (24-hour, zero-padded) for an `<input type="time">`. */
export function decimalHourToTimeInput(h: number): string {
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
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
  /** Overlap lane (0 = back) and lane count of its overlap group; 0 / 1 when alone. */
  lane: number;
  lanes: number;
  /** Full name + time range, for the hover tooltip. */
  title: string;
  /**
   * Where a tight block's label goes, since it can't fit inside:
   * "side" = in the band just right of the block (free time there);
   * "below" = under the band, truncated before the next outside label.
   * Percentages of the band width.
   */
  outside?: { mode: "side" | "below"; left: string; maxWidth: string };
}

/** Width of free band (%) a side label needs; below that it goes under. */
const SIDE_LABEL_MIN = 9;
/** Breathing room (%) between a block / label and the next thing. */
const LABEL_GAP = 0.6;

/**
 * Google-Calendar-style cascade for overlapping events. Events are grouped
 * into clusters of (transitively) overlapping time; within a cluster each
 * takes the first lane whose previous occupant has already ended. Earlier /
 * longer events land in the back lanes, so each later one is drawn offset
 * over them — every event's title strip stays visible.
 *
 * Returns `{ lane, lanes }` per event, in the original agenda order.
 */
export function layoutOverlaps(
  agenda: Pick<AgendaEvent, "start" | "end">[],
): { lane: number; lanes: number }[] {
  const out = agenda.map(() => ({ lane: 0, lanes: 1 }));
  const order = agenda
    .map((e, i) => ({ start: e.start, end: Math.max(e.end, e.start), i }))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  let cluster: number[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    for (const i of cluster) out[i].lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };

  for (const e of order) {
    if (e.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= e.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = e.end;
    out[e.i].lane = lane;
    cluster.push(e.i);
    clusterEnd = cluster.length === 1 ? e.end : Math.max(clusterEnd, e.end);
  }
  flush();
  return out;
}

export function buildArcEvents(
  agenda: AgendaEvent[],
  arc: ArcWindow,
  use24: boolean,
): ArcEventVM[] {
  const lanes = layoutOverlaps(agenda);
  const vms = agenda.map((e, i) => {
    // The label stays INSIDE the block wherever it can: full at ≥10%,
    // compact (small, wrapped, no time) down to 6%, and only below that
    // does it move outside the band.
    const w = Math.max(0.7, arcPct(e.end, arc) - arcPct(e.start, arc));
    const tight = w < 6;
    // Overlapping events share the band as a cascade of single-line strips;
    // that replaces the compact treatment (tight blocks still cascade, but
    // keep their outside label — see `.arc__event--stacked` in globals.css).
    const stacked = lanes[i].lanes > 1;
    const compact = w < 10 && w >= 6 && !stacked;
    return {
      label: e.name,
      timeLabel: formatHour(e.start, use24),
      left: arcPct(e.start, arc).toFixed(2),
      width: w.toFixed(2),
      cls:
        `arc__event arc__event--${e.kind}` +
        (compact ? " arc__event--compact" : "") +
        (tight ? " arc__event--tight" : "") +
        (stacked ? " arc__event--stacked" : ""),
      ...lanes[i],
      title: `${e.name} · ${formatHour(e.start, use24)} – ${formatHour(e.end, use24)}`,
      outside: tight ? placeOutsideLabel(agenda, i, arc) : undefined,
    };
  });

  // Below-band labels share one line: each is capped at the next one's start
  // (and ellipsized by CSS) so neighbours never run into each other.
  const below = vms
    .filter((vm) => vm.outside?.mode === "below")
    .sort((a, b) => Number(a.outside!.left) - Number(b.outside!.left));
  below.forEach((vm, k) => {
    const left = Number(vm.outside!.left);
    const next = below[k + 1] ? Number(below[k + 1].outside!.left) : 100;
    vm.outside!.maxWidth = Math.max(0, next - left - LABEL_GAP).toFixed(2);
  });
  return vms;
}

/**
 * Side label if the band is free to the right of event `i` for at least
 * SIDE_LABEL_MIN; otherwise below the band.
 */
function placeOutsideLabel(
  agenda: AgendaEvent[],
  i: number,
  arc: ArcWindow,
): NonNullable<ArcEventVM["outside"]> {
  const e = agenda[i];
  // Anything still running after this block ends blocks the band from
  // wherever it (or this block's end) starts.
  let blockedAt = arc.to;
  agenda.forEach((o, j) => {
    if (j !== i && o.end > e.end) blockedAt = Math.min(blockedAt, Math.max(o.start, e.end));
  });
  const end = arcPct(e.end, arc);
  const free = arcPct(blockedAt, arc) - end;
  if (free >= SIDE_LABEL_MIN) {
    return {
      mode: "side",
      left: (end + LABEL_GAP).toFixed(2),
      maxWidth: (free - 2 * LABEL_GAP).toFixed(2),
    };
  }
  return { mode: "below", left: arcPct(e.start, arc).toFixed(2), maxWidth: "0" };
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
