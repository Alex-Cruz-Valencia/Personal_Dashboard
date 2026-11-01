/** Who the day review covers and when. Pure, so it can be tested without a page. */

import type { Task, WeekDay } from "./types";

/** "morning" clears what's late; "night" closes today before it goes late. */
export type ReviewMode = "morning" | "night";

export const reviewMode = (nowHour: number, windDown: number): ReviewMode => (nowHour >= windDown ? "night" : "morning");

/** Oldest first, so the longest-ignored task gets the first decision. */
export function reviewTasks(tasks: Task[], mode: ReviewMode): Task[] {
  return tasks
    .filter((t) => t.id && (mode === "night" || (t.overdueDays ?? 0) > 0))
    .sort((a, b) => (b.overdueDays ?? 0) - (a.overdueDays ?? 0));
}

export function promptText(count: number, mode: ReviewMode): string {
  const n = `${count} ${count === 1 ? "task" : "tasks"}`;
  if (mode === "morning") return `${n} ${count === 1 ? "is" : "are"} overdue.`;
  return `${n} still open today. Plan ${count === 1 ? "it" : "them"} before tomorrow?`;
}

/** The first timed thing tomorrow, for the end of the night review. */
export function firstUp(day: WeekDay | null): { name: string; start: number } | null {
  const first = day?.events?.filter((e) => !e.allDay).sort((a, b) => a.start - b.start)[0];
  return first ? { name: first.name, start: first.start } : null;
}

/** "Done: 2 finished, 3 moved to tomorrow" style counts; empty parts are left out. */
export function closingLine(finished: number, moved: number, removed: number): string {
  const parts = [
    finished ? `${finished} finished` : null,
    moved ? `${moved} moved` : null,
    removed ? `${removed} removed` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

