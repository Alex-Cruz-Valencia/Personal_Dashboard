/**
 * Phase 3 — Tasks via Todoist REST API v2 (personal API token).
 *
 * Token + filter come from `config.todoist`. The filter defaults to
 * "(today | overdue)" so the card shows what actually needs doing today.
 */

import "server-only";
import { config } from "@/lib/config";
import { formatHour } from "@/lib/format";
import { decimalHourForTimestamp } from "@/lib/time";
import type { Priority, Task } from "@/lib/types";

const API = "https://api.todoist.com/rest/v2";

interface TodoistDue {
  date: string;
  datetime?: string | null;
  string: string;
  is_recurring: boolean;
}

interface TodoistTask {
  id: string;
  content: string;
  priority: 1 | 2 | 3 | 4; // 4 = P1 (urgent) … 1 = P4 (none)
  project_id: string;
  labels: string[];
  due: TodoistDue | null;
  order: number;
}

interface TodoistProject {
  id: string;
  name: string;
}

/** Todoist priority (4→1 urgent) → dashboard priority (1 urgent … 3 someday). */
function mapPriority(p: TodoistTask["priority"]): Priority {
  switch (p) {
    case 4:
      return 1;
    case 3:
      return 2;
    default:
      return 3;
  }
}

function hasExplicitZone(datetime: string): boolean {
  return /[zZ]$|[+-]\d\d:?\d\d$/.test(datetime);
}

function dueHourOf(due: TodoistDue | null, todayIso: string): number | null {
  if (!due?.datetime) return null;
  if (!hasExplicitZone(due.datetime)) {
    // Floating local time — read the clock components straight off the string.
    const t = due.datetime.split("T")[1] ?? "00:00:00";
    const [h, m] = t.split(":").map(Number);
    return h + (m || 0) / 60;
  }
  return decimalHourForTimestamp(due.datetime, todayIso, config.timezone);
}

function dueLabel(due: TodoistDue | null, todayIso: string): string {
  if (!due) return "—";
  const hour = dueHourOf(due, todayIso);
  if (hour != null) return formatHour(hour, true);
  if (due.date === todayIso) return "Today";
  const s = due.string?.trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Today";
}

async function todoistGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${config.todoist.token}` },
    next: { revalidate: 120 },
  });
  if (!res.ok) {
    throw new Error(`Todoist ${path} responded ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function getTasks(todayIso: string): Promise<Task[]> {
  if (!config.todoist.token) throw new Error("Todoist not configured");

  const [tasks, projects] = await Promise.all([
    todoistGet<TodoistTask[]>(
      `/tasks?filter=${encodeURIComponent(config.todoist.filter)}`,
    ),
    todoistGet<TodoistProject[]>("/projects").catch(() => [] as TodoistProject[]),
  ]);

  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  return tasks
    .map<Task>((t) => ({
      id: t.id,
      name: t.content,
      priority: mapPriority(t.priority),
      meta: projectName.get(t.project_id) ?? t.labels[0] ?? "Task",
      due: dueLabel(t.due, todayIso),
      dueHour: dueHourOf(t.due, todayIso),
    }))
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        (a.dueHour ?? 99) - (b.dueHour ?? 99) ||
        a.name.localeCompare(b.name),
    );
}
