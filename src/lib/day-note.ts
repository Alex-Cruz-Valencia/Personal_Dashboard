/**
 * Deterministic "shape of the day" line — the fallback when the Anthropic API
 * is not configured (or errors) but real data is present, so the note still
 * says something true about today.
 *
 * Three voices, picked in ⚙ → Day note (`settings.noteStyle`):
 * - timely (default): leads with real numbers — how much free time is left —
 *   then what to focus on ("get started on" when the task won't fit);
 * - gentle: softer, encouraging;
 * - plain: just the facts.
 */

import { formatHour } from "./format";
import { buildPlan, minutesLabel, taskMinutes } from "./plan";
import type { NoteStyle } from "./settings";
import type { AgendaEvent, Task } from "./types";

export interface DayNoteOptions {
  style?: NoteStyle;
  /** End of the viewer's day (decimal hour), for "free until …". */
  dayEnd?: number;
  /** From this hour the note only suggests winding down (settings.windDown). */
  windDown?: number;
  use24?: boolean;
}

export function deterministicDayNote(
  nowHour: number,
  tasks: Task[],
  agenda: AgendaEvent[],
  { style = "timely", dayEnd: lastHour = 22, windDown = WIND_DOWN_HOUR, use24 = false }: DayNoteOptions = {},
): string {
  // From wind-down on, the note stops pointing at work at all — and before
  // it, free time only counts up to wind-down, not the end of the day.
  if (nowHour >= windDown) return windDownNote(nowHour, agenda, style, use24);
  const dayEnd = Math.min(lastHour, windDown);

  const firstMeeting = agenda
    .filter((e) => e.kind === "meeting" && e.start > nowHour)
    .sort((a, b) => a.start - b.start)[0];
  // Best task to point at: urgent, then normal, then someday — only an
  // empty list leaves the note without one.
  const topTask =
    tasks.find((t) => t.priority === 1) ??
    tasks.find((t) => t.priority === 2) ??
    tasks[0];
  // No quotes around names (they read heavy); the task is wrapped in
  // **…** so HelloCard can set it in bold — see `splitNote`.
  const task = topTask ? `**${topTask.name.replace(/\*\*/g, "")}**` : "";

  if (firstMeeting) {
    const window = minutesLabel(Math.max(1, Math.round((firstMeeting.start - nowHour) * 60)));
    const meeting = firstMeeting.name;
    if (!topTask) {
      switch (style) {
        case "gentle":
          return `${window} until ${meeting}, and your list is clear.`;
        case "plain":
          return `${window} until ${meeting}; no tasks left.`;
        default:
          return `${window} before ${meeting} — your list is clear.`;
      }
    }
    const fits = taskMinutes(topTask) <= (firstMeeting.start - nowHour) * 60;
    switch (style) {
      case "gentle":
        return `${window} until ${meeting}. Good time for ${task}.`;
      case "plain":
        return `${window} until ${meeting}; top priority is ${task}.`;
      default:
        return fits
          ? `${window} before ${meeting} — focus on ${task}.`
          : `${window} before ${meeting} — get started on ${task}.`;
    }
  }

  // No meetings left: how much plannable time is there until the day ends?
  const free = buildPlan(agenda, [], nowHour, dayEnd).freeMinutes;
  const until = formatHour(dayEnd, use24).replace(":00", "");

  if (!topTask) {
    switch (style) {
      case "gentle":
        return free > 0
          ? "Your list is clear — the rest of the day is yours."
          : "Your list is clear — enjoy the evening.";
      case "plain":
        return "No meetings left and no tasks.";
      default:
        return free > 0
          ? `${minutesLabel(free)} free until ${until} — your list is clear.`
          : "Your list is clear — that's a wrap for today.";
    }
  }
  if (free === 0) {
    switch (style) {
      case "gentle":
        return `Wind down when you can — ${task} will keep for tomorrow.`;
      case "plain":
        return `Day's nearly over; top priority is still ${task}.`;
      default:
        return `The day's almost done — ${task} is still open.`;
    }
  }
  switch (style) {
    case "gentle":
      return `The rest of the day is yours. Start with ${task}.`;
    case "plain":
      return `No meetings left; your top priority is ${task}.`;
    default:
      return taskMinutes(topTask) <= free
        ? `${minutesLabel(free)} free until ${until} — focus on ${task}.`
        : `${minutesLabel(free)} free until ${until} — get started on ${task}.`;
  }
}

/** Default wind-down (9pm) — the user's own is `settings.windDown`. */
export const WIND_DOWN_HOUR = 21;

/**
 * The evening note: no tasks, no "focus on". If something's still on the
 * calendar tonight, it says when the day actually ends.
 */
function windDownNote(
  nowHour: number,
  agenda: AgendaEvent[],
  style: NoteStyle,
  use24: boolean,
): string {
  const lastEnd = Math.max(
    0,
    ...agenda.filter((e) => e.end > nowHour).map((e) => e.end),
  );
  if (lastEnd > nowHour) {
    const at = formatHour(lastEnd, use24).replace(":00", "");
    switch (style) {
      case "gentle":
        return `Almost there — one more thing until ${at}, then rest.`;
      case "plain":
        return `Last event ends at ${at}.`;
      default:
        return `Last thing on the calendar wraps at ${at} — then wind down.`;
    }
  }
  switch (style) {
    case "gentle":
      return "Time to start winding down for the night.";
    case "plain":
      return "Done for the day.";
    default:
      return "That's it for today — time to wind down.";
  }
}

/** One-line steer for the AI-written note, so it matches the chosen voice. */
export const NOTE_STYLE_PROMPT: Record<NoteStyle, string> = {
  timely:
    "Voice: lead with concrete numbers — how much free time there is and until when — then say what to focus on.",
  gentle: "Voice: warm and encouraging, like a calm friend; no numbers unless they help.",
  plain: "Voice: plain and factual, no adjectives — just the time available and the top priority.",
};

/** The note's markup: `**…**` marks the task name, set in bold. */
export function splitNote(note: string): { text: string; bold: boolean }[] {
  return note
    .split(/\*\*(.+?)\*\*/g)
    .map((text, i) => ({ text, bold: i % 2 === 1 }))
    .filter((part) => part.text);
}
