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
  use24?: boolean;
}

export function deterministicDayNote(
  nowHour: number,
  tasks: Task[],
  agenda: AgendaEvent[],
  { style = "timely", dayEnd = 22, use24 = false }: DayNoteOptions = {},
): string {
  const firstMeeting = agenda
    .filter((e) => e.kind === "meeting" && e.start > nowHour)
    .sort((a, b) => a.start - b.start)[0];
  const topTask =
    tasks.find((t) => t.priority === 1) ?? tasks.find((t) => t.priority === 2);
  // No quotes around names (they read heavy); the task is wrapped in
  // **…** so HelloCard can set it in bold — see `renderNote`.
  const task = topTask ? `**${topTask.name.replace(/\*\*/g, "")}**` : "";

  if (firstMeeting) {
    const window = minutesLabel(Math.max(1, Math.round((firstMeeting.start - nowHour) * 60)));
    const meeting = firstMeeting.name;
    if (!topTask) {
      return `${window} until your next meeting, ${meeting} at ${formatHour(firstMeeting.start, use24)}.`;
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

  if (!topTask) return "Nothing scheduled and nothing urgent — an unusually open day.";

  // No meetings left: how much plannable time is there until the day ends?
  const free = buildPlan(agenda, [], nowHour, dayEnd).freeMinutes;
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
        ? `${minutesLabel(free)} free until ${formatHour(dayEnd, use24).replace(":00", "")} — focus on ${task}.`
        : `${minutesLabel(free)} free until ${formatHour(dayEnd, use24).replace(":00", "")} — get started on ${task}.`;
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
