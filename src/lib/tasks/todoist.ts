/**
 * Phase 3 — Tasks via the Todoist API v1 (personal API token).
 *
 * Token + filter come from `config.todoist`. The filter defaults to
 * "(today | overdue)" so the card shows what actually needs doing today.
 *
 * Note: the old `/rest/v2/*` endpoints now return 410 — this uses the unified
 * v1 API (`https://api.todoist.com/api/v1/*`), which wraps lists in
 * `{ results, next_cursor }`.
 */

import "server-only";
import { config } from "@/lib/config";
import { formatHour } from "@/lib/format";
import { decimalHourForTimestamp } from "@/lib/time";
import type { Priority, Task } from "@/lib/types";

const API = "https://api.todoist.com/api/v1";

interface TodoistDue {
  /** "YYYY-MM-DD" for all-day, or a full RFC3339 timestamp for timed tasks. */
  date: string;
  /** Set only when the task has a fixed time; null = floating. */
  timezone: string | null;
  string: string;
  is_recurring: boolean;
}

interface TodoistTask {
  id: string;
  content: string;
  /** 4 = P1 (urgent) … 1 = P4 (no priority). */
  priority: 1 | 2 | 3 | 4;
  project_id: string;
  labels: string[];
  due: TodoistDue | null;
}

interface TodoistProject {
  id: string;
  name: string;
}

interface Page<T> {
  results: T[];
  next_cursor: string | null;
}

/** Todoist priority (4 = urgent) → dashboard priority (1 urgent … 3 someday). */
function mapPriority(p: TodoistTask["priority"]): Priority {
  switch (p) {
    case 4:
      return 1;
    case 3:
    case 2:
      return 2;
    default:
      return 3;
  }
}

function isTimed(due: TodoistDue): boolean {
  return due.date.includes("T");
}

function hasExplicitZone(value: string): boolean {
  return /[zZ]$|[+-]\d\d:?\d\d$/.test(value);
}

function dueHourOf(
  due: TodoistDue | null,
  todayIso: string,
  timezone: string,
): number | null {
  if (!due || !isTimed(due)) return null;
  if (!hasExplicitZone(due.date)) {
    // Floating local time — read the clock components straight off the string.
    const t = due.date.split("T")[1] ?? "00:00:00";
    const [h, m] = t.split(":").map(Number);
    return h + (m || 0) / 60;
  }
  return decimalHourForTimestamp(due.date, todayIso, timezone);
}

function dueLabel(
  due: TodoistDue | null,
  todayIso: string,
  timezone: string,
): string {
  if (!due) return "—";
  const hour = dueHourOf(due, todayIso, timezone);
  if (hour != null) return formatHour(hour, true);
  if (due.date === todayIso) return "Today";
  const s = due.string?.trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Today";
}

async function todoistGet<T>(path: string): Promise<Page<T>> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${config.todoist.token}` },
    next: { revalidate: 120 },
  });
  if (!res.ok) {
    throw new Error(`Todoist ${path} responded ${res.status}`);
  }
  return (await res.json()) as Page<T>;
}

export async function getTasks(
  todayIso: string,
  timezone: string,
): Promise<Task[]> {
  if (!config.todoist.token) throw new Error("Todoist not configured");

  const [tasks, projects] = await Promise.all([
    todoistGet<TodoistTask>(
      `/tasks/filter?query=${encodeURIComponent(config.todoist.filter)}&limit=200`,
    ),
    todoistGet<TodoistProject>("/projects?limit=200").catch(
      () => ({ results: [], next_cursor: null }) as Page<TodoistProject>,
    ),
  ]);

  const projectName = new Map(projects.results.map((p) => [p.id, p.name]));

  return tasks.results
    .map<Task>((t) => ({
      id: t.id,
      name: t.content,
      priority: mapPriority(t.priority),
      meta: projectName.get(t.project_id) ?? t.labels[0] ?? "Task",
      due: dueLabel(t.due, todayIso, timezone),
      dueHour: dueHourOf(t.due, todayIso, timezone),
    }))
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        (a.dueHour ?? 99) - (b.dueHour ?? 99) ||
        a.name.localeCompare(b.name),
    );
}
