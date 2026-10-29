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
import { decimalHourForTimestamp, isoDateInZone } from "@/lib/time";
import type { Priority, Project, Task, WeekTask } from "@/lib/types";

const API = "https://api.todoist.com/api/v1";
/** A hung Todoist call would hold the whole page render; give up instead. */
const TIMEOUT_MS = 15_000;

/** Cache tag on task reads — mutations call `revalidateTag(TODOIST_TAG)`. */
export const TODOIST_TAG = "todoist";

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
  description: string;
  /** 4 = P1 (urgent) … 1 = P4 (no priority). */
  priority: 1 | 2 | 3 | 4;
  project_id: string;
  labels: string[];
  due: TodoistDue | null;
  deadline: { date: string } | null;
  duration: { amount: number; unit: string } | null;
}

interface TodoistProject {
  id: string;
  name: string;
  is_archived?: boolean;
}

interface TodoistLabel {
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

function durationToMinutes(
  d: { amount: number; unit: string } | null,
): number | null {
  if (!d) return null;
  return d.unit === "day" ? d.amount * 24 * 60 : d.amount;
}

function hasExplicitZone(value: string): boolean {
  return /[zZ]$|[+-]\d\d:?\d\d$/.test(value);
}

/** The local date a due falls on: a zoned timestamp is read in the viewer's zone, not as UTC. */
function dueDayOf(due: TodoistDue, timezone: string): string {
  return isTimed(due) && hasExplicitZone(due.date)
    ? isoDateInZone(new Date(due.date), timezone)
    : due.date.slice(0, 10);
}

/** Due time as a decimal hour, only when it falls on `todayIso` (an overdue 3pm isn't "3pm today"). */
function dueHourOf(
  due: TodoistDue | null,
  todayIso: string,
  timezone: string,
): number | null {
  if (!due || !isTimed(due) || dueDayOf(due, timezone) !== todayIso) return null;
  if (!hasExplicitZone(due.date)) {
    // Floating local time — read the clock components straight off the string.
    const t = due.date.split("T")[1] ?? "00:00:00";
    const [h, m] = t.split(":").map(Number);
    return h + (m || 0) / 60;
  }
  return decimalHourForTimestamp(due.date, todayIso, timezone);
}

/** Whole calendar days a due date is behind today (0 when due today or later). */
function overdueDaysOf(due: TodoistDue | null, todayIso: string, timezone: string): number {
  if (!due) return 0;
  const day = dueDayOf(due, timezone);
  if (day >= todayIso) return 0;
  const ms = Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`);
  return Math.max(1, Math.round(ms / 86_400_000));
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
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: 30, tags: [TODOIST_TAG] },
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
      overdueDays: overdueDaysOf(t.due, todayIso, timezone) || undefined,
      projectId: t.project_id,
      description: t.description || undefined,
      labels: t.labels,
      isRecurring: t.due?.is_recurring ?? false,
      recurrence: t.due?.is_recurring ? t.due.string : undefined,
      deadline: t.deadline?.date ?? null,
      durationMinutes: durationToMinutes(t.duration),
    }))
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        (a.dueHour ?? 99) - (b.dueHour ?? 99) ||
        a.name.localeCompare(b.name),
    );
}

/* ---------- projects & labels (for the task editor) ---------- */

function metaTtl(): NextFetchRequestConfig {
  return { revalidate: 300, tags: [TODOIST_TAG] };
}

export async function listProjects(): Promise<Project[]> {
  if (!config.todoist.token) throw new Error("Todoist not configured");
  const res = await fetch(`${API}/projects?limit=200`, {
    headers: { Authorization: `Bearer ${config.todoist.token}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: metaTtl(),
  });
  if (!res.ok) throw new Error(`Todoist /projects responded ${res.status}`);
  const page = (await res.json()) as Page<TodoistProject>;
  return page.results
    .filter((p) => !p.is_archived)
    .map((p) => ({ id: p.id, name: p.name }));
}

export async function listLabels(): Promise<string[]> {
  if (!config.todoist.token) throw new Error("Todoist not configured");
  const res = await fetch(`${API}/labels?limit=200`, {
    headers: { Authorization: `Bearer ${config.todoist.token}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: metaTtl(),
  });
  if (!res.ok) throw new Error(`Todoist /labels responded ${res.status}`);
  const page = (await res.json()) as Page<TodoistLabel>;
  return page.results.map((l) => l.name);
}

/* ---------- writes ---------- */

/** Dashboard priority (1 urgent … 3 someday) → Todoist priority (4 … 1). */
const TO_TODOIST_PRIORITY: Record<Priority, number> = { 1: 4, 2: 3, 3: 1 };

export interface TaskPatch {
  /** New task text. */
  content?: string;
  description?: string;
  /** Dashboard scale: 1 = urgent, 2 = normal, 3 = someday. */
  priority?: Priority;
  /** Natural-language due ("tomorrow 9am", "every monday"), or null to clear. */
  due?: string | null;
  labels?: string[];
  /** Hard deadline, ISO date "YYYY-MM-DD", or null to clear. */
  deadline?: string | null;
  /** Planned working time in minutes, or null to clear. */
  durationMinutes?: number | null;
}

export interface NewTask {
  content: string;
  projectId?: string;
  priority?: Priority;
  /** Natural-language due ("tomorrow 9am"). Prefer `dueDate` when you have a date. */
  due?: string;
  /** Structured due date, "YYYY-MM-DD" — no shortcut parsing involved. */
  dueDate?: string;
  description?: string;
  labels?: string[];
  /** Hard deadline, "YYYY-MM-DD". */
  deadline?: string;
  /** Planned working time in minutes. Todoist only keeps it on tasks with a due time. */
  durationMinutes?: number;
}

async function todoistWrite(
  path: string,
  method: "POST" | "DELETE",
  body?: Record<string, unknown>,
): Promise<unknown> {
  if (!config.todoist.token) throw new Error("Todoist not configured");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.todoist.token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Todoist ${method} ${path} responded ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export function completeTask(id: string): Promise<unknown> {
  return todoistWrite(`/tasks/${id}/close`, "POST");
}

export function reopenTask(id: string): Promise<unknown> {
  return todoistWrite(`/tasks/${id}/reopen`, "POST");
}

export function deleteTask(id: string): Promise<unknown> {
  return todoistWrite(`/tasks/${id}`, "DELETE");
}

export function updateTask(id: string, patch: TaskPatch): Promise<unknown> {
  const body: Record<string, unknown> = {};
  if (patch.content !== undefined) body.content = patch.content;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.priority !== undefined) {
    body.priority = TO_TODOIST_PRIORITY[patch.priority];
  }
  if (patch.labels !== undefined) body.labels = patch.labels;
  if (patch.due === null) body.due_string = "no date";
  else if (patch.due !== undefined) body.due_string = patch.due;
  if (patch.deadline === null) body.deadline_date = null;
  else if (patch.deadline !== undefined) body.deadline_date = patch.deadline;
  if (patch.durationMinutes === null) {
    body.duration = null;
  } else if (patch.durationMinutes !== undefined) {
    body.duration = patch.durationMinutes;
    body.duration_unit = "minute";
  }
  return todoistWrite(`/tasks/${id}`, "POST", body);
}

/** Move a task to a different project (Todoist keeps this separate from update). */
export function moveTask(id: string, projectId: string): Promise<unknown> {
  return todoistWrite(`/tasks/${id}/move`, "POST", { project_id: projectId });
}

export function addTask(task: NewTask): Promise<unknown> {
  const body: Record<string, unknown> = { content: task.content };
  if (task.projectId) body.project_id = task.projectId;
  if (task.priority !== undefined) {
    body.priority = TO_TODOIST_PRIORITY[task.priority];
  }
  if (task.dueDate) body.due_date = task.dueDate;
  else if (task.due) body.due_string = task.due;
  if (task.description) body.description = task.description;
  if (task.labels?.length) body.labels = task.labels;
  if (task.deadline) body.deadline_date = task.deadline;
  if (task.durationMinutes) {
    const withDuration = { ...body, duration: task.durationMinutes, duration_unit: "minute" };
    // A date-only due is refused with a duration; the task matters more than the estimate.
    return todoistWrite("/tasks", "POST", withDuration).catch((err: Error) =>
      /responded 400/.test(err.message) ? todoistWrite("/tasks", "POST", body) : Promise.reject(err),
    );
  }
  return todoistWrite("/tasks", "POST", body);
}

/**
 * Tasks due over the coming week (today included), grouped by ISO date. One
 * extra read, used by the week strip (counts) and its expanded view (names).
 */
export async function getWeekTasks(
  timezone: string,
): Promise<Record<string, WeekTask[]>> {
  if (!config.todoist.token) throw new Error("Todoist not configured");
  const page = await todoistGet<TodoistTask>(
    `/tasks/filter?query=${encodeURIComponent("7 days")}&limit=200`,
  );
  const byDay: Record<string, WeekTask[]> = {};
  for (const t of page.results) {
    if (!t.due) continue;
    // Timed tasks carry a timestamp; read its date in the viewer's zone.
    const day = dueDayOf(t.due, timezone);
    (byDay[day] ??= []).push({
      id: t.id,
      name: t.content,
      priority: mapPriority(t.priority),
      dueHour: dueHourOf(t.due, day, timezone),
    });
  }
  for (const list of Object.values(byDay)) {
    list.sort((a, b) => a.priority - b.priority || (a.dueHour ?? 99) - (b.dueHour ?? 99) || a.name.localeCompare(b.name));
  }
  return byDay;
}
