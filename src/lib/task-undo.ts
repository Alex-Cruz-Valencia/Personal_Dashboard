/** How to take back a task write. Pure, so it can be tested without Todoist. */

import type { Task } from "./types";

/** The body that puts `task`'s date back, repeat and time included. */
function dueBack(task: Task, removing: boolean): Record<string, unknown> {
  if (!removing) return { date: task.dueDate ?? null };
  // Clearing a date drops its repeat and time, so a bare day wouldn't bring those back.
  if (task.isRecurring && task.recurrence) return { due: task.recurrence };
  if (task.dueDate && task.dueHour !== null) {
    const h = Math.floor(task.dueHour);
    const m = Math.round((task.dueHour - h) * 60);
    return { due: `${task.dueDate} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` };
  }
  return { date: task.dueDate ?? null };
}

/** The PATCH that reverses a task menu's PATCH; null when that field can't be taken back. */
export function revertPatch(task: Task, change: Record<string, unknown>): Record<string, unknown> | null {
  if ("date" in change) return dueBack(task, change.date === null);
  if ("todoistPriority" in change) return { todoistPriority: task.todoistPriority ?? 4 };
  if ("deadline" in change) return { deadline: task.deadline ?? null };
  if ("projectId" in change || "sectionId" in change) {
    return task.sectionId ? { sectionId: task.sectionId } : task.projectId ? { projectId: task.projectId } : null;
  }
  return null;
}

export function changeText(change: Record<string, unknown>): string {
  if ("date" in change) return "Date changed";
  if ("todoistPriority" in change) return "Priority changed";
  if ("deadline" in change) return "Deadline changed";
  return "Task moved";
}

/**
 * Completing a repeating task moves it to its next date rather than closing it, so reopening
 * does nothing: the date has to go back instead.
 */
export function uncompleteRequest(task: Task): { path: string; method: "POST" | "PATCH"; body?: Record<string, unknown> } {
  const id = task.id as string;
  if (task.isRecurring) return { path: `/api/tasks/${id}`, method: "PATCH", body: { date: task.dueDate ?? null } };
  return { path: `/api/tasks/${id}/reopen`, method: "POST" };
}
