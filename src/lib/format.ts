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

/* ---------- the day arc ---------- */

export interface ArcEventVM {
  label: string;
  timeLabel: string;
  /** "10:30 – 11:30am" and the location line — shown in the expanded view. */
  rangeLabel: string;
  where: string;
  left: string;
  width: string;
  cls: string;
  /** Overlap lane (0 = back) and lane count of its overlap group; 0 / 1 when alone. */
  lane: number;
  lanes: number;
  /** Full name + time range, for the hover tooltip. */
  title: string;
  /**
   * Fallback label for a tight block, used only when the block turns out to
   * be too few pixels wide to show its own text (a CSS container query on
   * the block decides — see globals.css). Sits in free band beside the
   * block; `maxWidth` is a % of the BLOCK's width, since it renders inside it.
   * Absent when both sides are crowded (the hover tooltip still names it).
   */
  side?: { dir: "right" | "left"; maxWidth: string };
  /**
   * Overlap strips in the expanded view (where every size is known in px):
   * extra classes + CSS vars letting the name wrap into whatever part of the
   * block no later lane draws over. See `stackedText()`.
   */
  textCls?: string;
  textVars?: Record<string, string | number>;
  /** The time line only has room for the start time, not the range. */
  shortTime?: boolean;
}

/** Free band (% of the arc) a side label needs to be worth showing. */
const SIDE_LABEL_MIN = 7;
/** Breathing room (%) between a block and its side label / the next thing. */
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

/**
 * Expanded day arc: pixels per hour the day NEEDS so its shortest event
 * gets ~EXPANDED_MIN_EVENT_PX — room for name, time range and location.
 * The zoom follows the day's content rather than a fixed factor. No floor:
 * `DayArc` takes max(this, what fits the card), so a day that already fits
 * doesn't scroll at all. Capped so a 5-minute blip can't make the arc a
 * mile wide.
 */
export const EXPANDED_MIN_EVENT_PX = 120;
export function expandedHourPx(agenda: Pick<AgendaEvent, "start" | "end">[]): number {
  const shortest = Math.min(
    ...agenda.map((e) => e.end - e.start).filter((d) => d > 0),
  );
  const px = Number.isFinite(shortest) ? EXPANDED_MIN_EVENT_PX / shortest : 0;
  return Math.round(Math.min(200, px));
}

export function buildArcEvents(
  agenda: AgendaEvent[],
  arc: ArcWindow,
  use24: boolean,
  /** Expanded view: the arc's real width is known, so size classes by px. */
  hourPx?: number,
): ArcEventVM[] {
  const lanes = layoutOverlaps(agenda);
  return agenda.map((e, i) => {
    // The label always stays INSIDE the block: full at ≥10%, compact (small,
    // wrapped, no time) down to 6%, and tight below that — where CSS sizes
    // the text by the block's real pixel width and only drops it (for the
    // side label) when there's genuinely no room. The % cut-offs are the
    // reference's; with a known hourPx they become their px equivalents at
    // the reference's ~1100px band (66 / 110px).
    const w = Math.max(0.7, arcPct(e.end, arc) - arcPct(e.start, arc));
    const px = hourPx ? (e.end - e.start) * hourPx : undefined;
    const tight = px !== undefined ? px < 66 : w < 6;
    // Overlapping events share the band as a cascade of single-line strips;
    // that replaces the compact treatment.
    const stacked = lanes[i].lanes > 1;
    const compact =
      !stacked && !tight && (px !== undefined ? px < 110 : w < 10);
    return {
      label: e.name,
      timeLabel: formatHour(e.start, use24),
      rangeLabel: `${formatHour(e.start, use24)} – ${formatHour(e.end, use24)}`,
      where: e.where,
      left: arcPct(e.start, arc).toFixed(2),
      width: w.toFixed(2),
      cls:
        `arc__event arc__event--${e.kind}` +
        (compact ? " arc__event--compact" : "") +
        (tight ? " arc__event--tight" : "") +
        (stacked ? " arc__event--stacked" : ""),
      ...lanes[i],
      title: `${e.name} · ${formatHour(e.start, use24)} – ${formatHour(e.end, use24)}`,
      side: tight ? placeSideLabel(agenda, i, arc, w) : undefined,
      ...(stacked && !tight && hourPx
        ? stackedText(agenda, lanes, i, hourPx, use24)
        : {}),
    };
  });
}

/* Geometry of the expanded arc's overlap cascade — mirrors globals.css
   (`.dayarc--expanded .arc__event--stacked`: --ev-h 100px, --step
   min(30px, ev-h / lanes), 9px side padding, 15px lines). */
const X_EV_H = 100;
const X_STEP_MAX = 30;
const X_LINE = 15;
const X_PAD_X = 9;

/**
 * How an overlap strip's text fits, expanded view only. A later lane is
 * drawn on top of the lower part of this block from wherever it starts, so:
 * - "wrap": the block has open room — it's the front lane, or the lane over
 *   it starts well into it — so the name wraps (up to 3 lines) within that
 *   open width, with the time below when there's height for it;
 * - "strip2": only its own strip shows, but the strip is tall enough for two
 *   small lines — used when name + time won't fit on one;
 * - otherwise the single-line strip (name … time).
 */
function stackedText(
  agenda: AgendaEvent[],
  lanes: { lane: number; lanes: number }[],
  i: number,
  hourPx: number,
  use24: boolean,
): Pick<ArcEventVM, "textCls" | "textVars" | "shortTime"> {
  const e = agenda[i];
  const { lane, lanes: n } = lanes[i];
  const dur = e.end - e.start;
  const step = Math.min(X_STEP_MAX, X_EV_H / n);
  const height = X_EV_H - lane * step;
  const padTop = Math.max(0, (step - X_LINE) / 2);

  // Where the first later lane drawn over this block starts, as a fraction
  // of the block's width (1 = nothing covers it).
  let open = 1;
  agenda.forEach((o, j) => {
    if (lanes[j].lane > lane && o.start < e.end && o.end > e.start) {
      open = Math.min(open, Math.max(0, (o.start - e.start) / dur));
    }
  });
  const openPx = open * dur * hourPx - 2 * X_PAD_X;
  const avail = height - padTop - 6;

  if (openPx >= 70 && avail >= 2 * X_LINE) {
    const withTime = avail >= 3 * X_LINE + 2 && openPx >= 80;
    const lines = Math.min(3, Math.floor((avail - (withTime ? X_LINE + 2 : 0)) / X_LINE));
    const range = `${formatHour(e.start, use24)} – ${formatHour(e.end, use24)}`;
    return {
      shortTime: range.length * 6.4 > openPx,
      textCls: " arc__event--wrap" + (withTime ? " arc__event--wraptime" : ""),
      textVars: { "--open": `${(open * 100).toFixed(1)}%`, "--lines": Math.max(1, lines) },
    };
  }

  // Rough one-line fit check for name + range at the strip's font sizes.
  const range = `${formatHour(e.start, use24)} – ${formatHour(e.end, use24)}`;
  const needPx = e.name.length * 6.6 + range.length * 6 + 6;
  if (step >= 28 && needPx > dur * hourPx - 2 * X_PAD_X) {
    return { textCls: " arc__event--strip2" };
  }
  return {};
}

/**
 * Free band to the right of event `i` (preferred), else to its left, as a
 * side label for when the block is too narrow for its own text.
 */
function placeSideLabel(
  agenda: AgendaEvent[],
  i: number,
  arc: ArcWindow,
  widthPct: number,
): ArcEventVM["side"] {
  const e = agenda[i];
  // Right: anything still running after this block ends blocks the band from
  // wherever it (or this block's end) starts. Left: mirror image.
  let rightStop = arc.to;
  let leftStop = arc.from;
  agenda.forEach((o, j) => {
    if (j === i) return;
    if (o.end > e.end) rightStop = Math.min(rightStop, Math.max(o.start, e.end));
    if (o.start < e.start) leftStop = Math.max(leftStop, Math.min(o.end, e.start));
  });
  const right = arcPct(rightStop, arc) - arcPct(e.end, arc);
  const left = arcPct(e.start, arc) - arcPct(leftStop, arc);
  const asBlockPct = (free: number) =>
    (((free - 2 * LABEL_GAP) / widthPct) * 100).toFixed(1);
  if (right >= SIDE_LABEL_MIN) return { dir: "right", maxWidth: asBlockPct(right) };
  if (left >= SIDE_LABEL_MIN) return { dir: "left", maxWidth: asBlockPct(left) };
  return undefined;
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
  /** Hours between labels — 1 in the expanded view, where there's room. */
  step = 2,
): { left: string; label: string }[] {
  const labels: { left: string; label: string }[] = [];
  for (let h = arc.from; h <= arc.to; h += step) {
    labels.push({
      left: arcPct(h, arc).toFixed(2),
      label: formatHour(h, use24).replace(":00", ""),
    });
  }
  return labels;
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
