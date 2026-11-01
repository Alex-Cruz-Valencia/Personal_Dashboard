import type { Project, Section } from "@/lib/types";

export interface TaskMeta {
  projects: Project[];
  sections?: Section[];
  labels: string[];
}

/** The page stays open all day, so a new project or label shows up within this long. */
const FRESH_MS = 5 * 60_000;

// Shared by the task editor and the new-task form. A failed load isn't kept, so the next one retries.
let cache: Promise<TaskMeta> | null = null;
let fetchedAt = 0;

export function loadTaskMeta(): Promise<TaskMeta> {
  if (cache && Date.now() - fetchedAt < FRESH_MS) return cache;
  fetchedAt = Date.now();
  cache = fetch("/api/tasks/meta")
    .then((r) => {
      if (!r.ok) throw new Error();
      return r.json() as Promise<TaskMeta>;
    })
    .catch(() => {
      cache = null;
      return { projects: [], labels: [] };
    });
  return cache;
}
