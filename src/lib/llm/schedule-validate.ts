/**
 * Pure checks on what the model proposes for the day, so a bad or hostile
 * answer can never reach the UI: every suggestion must name a real task, fit
 * inside an open gap, and not overlap another suggestion.
 */

export interface ScheduleGap {
  start: number;
  end: number;
}

export interface ScheduleTask {
  id: string;
  name: string;
  priority: 1 | 2 | 3;
  minutes: number;
  due: string;
  overdueDays?: number;
  deadline?: string | null;
}

export interface ScheduleSuggestion {
  taskId: string;
  /** Decimal hour, on the 5-minute grid. */
  start: number;
  minutes: number;
  reason: string;
}

const GRID = 5 / 60;
const MAX_SUGGESTIONS = 6;

/**
 * Pull the suggestions out of a model reply: a JSON array (possibly wrapped in
 * prose or a code fence), or, when the reply was cut off mid-array, whichever
 * complete objects came before the cut.
 */
export function extractJsonArray(text: string): unknown[] | null {
  const a = text.indexOf("[");
  const b = text.lastIndexOf("]");
  if (a >= 0 && b > a) {
    try {
      const parsed: unknown = JSON.parse(text.slice(a, b + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fall through to the per-object salvage */
    }
  }
  if (a < 0) return null;
  const objects: unknown[] = [];
  for (const m of text.slice(a).matchAll(/\{[^{}]*\}/g)) {
    try {
      objects.push(JSON.parse(m[0]));
    } catch {
      /* skip a malformed object */
    }
  }
  return objects.length ? objects : null;
}

export function validateSuggestions(
  raw: unknown[],
  tasks: ScheduleTask[],
  gaps: ScheduleGap[],
  nowHour: number,
): ScheduleSuggestion[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const used = new Set<string>();
  const placed: { start: number; end: number }[] = [];
  const out: ScheduleSuggestion[] = [];

  for (const item of raw) {
    if (out.length >= MAX_SUGGESTIONS) break;
    if (!item || typeof item !== "object") continue;
    const { taskId, start, reason } = item as Record<string, unknown>;
    if (typeof taskId !== "string" || typeof start !== "number" || !Number.isFinite(start)) continue;
    const task = byId.get(taskId);
    if (!task || used.has(taskId)) continue;

    // Always the task's own length, never one the model invented.
    const length = task.minutes / 60;
    const s = Math.ceil(start / GRID - 1e-9) * GRID;
    const e = s + length;
    if (s < nowHour - 1e-9) continue;
    if (!gaps.some((g) => s >= g.start - 1e-9 && e <= g.end + 1e-9)) continue;
    if (placed.some((p) => s < p.end - 1e-9 && e > p.start + 1e-9)) continue;

    used.add(taskId);
    placed.push({ start: s, end: e });
    out.push({
      taskId,
      start: Math.round(s * 60) / 60,
      minutes: task.minutes,
      reason: typeof reason === "string" ? reason.replace(/\s+/g, " ").trim().slice(0, 140) : "",
    });
  }
  return out.sort((a, b) => a.start - b.start);
}
