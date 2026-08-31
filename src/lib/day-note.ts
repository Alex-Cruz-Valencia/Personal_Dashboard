/**
 * Deterministic "shape of the day" line — the fallback when the Anthropic API
 * is not configured (or errors) but real data is present, so the note still
 * says something true about today.
 */

import { formatHour } from "./format";
import type { AgendaEvent, Task } from "./types";

export function deterministicDayNote(
  nowHour: number,
  tasks: Task[],
  agenda: AgendaEvent[],
): string {
  const firstMeeting = agenda
    .filter((e) => e.kind === "meeting" && e.start > nowHour)
    .sort((a, b) => a.start - b.start)[0];
  const topTask =
    tasks.find((t) => t.priority === 1) ?? tasks.find((t) => t.priority === 2);

  if (firstMeeting) {
    const freeMins = Math.round((firstMeeting.start - nowHour) * 60);
    const h = Math.floor(freeMins / 60);
    const m = freeMins % 60;
    const window =
      h > 0 ? `${h}h ${m}m` : `${m} minutes`;
    if (topTask) {
      return `${window} clear before “${firstMeeting.name}” — best spent on “${topTask.name}”.`;
    }
    return `${window} clear before your first meeting, “${firstMeeting.name}” at ${formatHour(firstMeeting.start, false)}.`;
  }

  if (topTask) {
    return `No more meetings today — “${topTask.name}” is the one thing worth finishing.`;
  }
  return "Nothing scheduled and nothing urgent — an unusually open day.";
}
