import type { Project } from "@/lib/types";

export interface TaskMeta {
  projects: Project[];
  labels: string[];
}

// Fetched once per session, shared by the task editor and the new-task form.
let cache: Promise<TaskMeta> | null = null;

export function loadTaskMeta(): Promise<TaskMeta> {
  cache ??= fetch("/api/tasks/meta")
    .then((r) => (r.ok ? (r.json() as Promise<TaskMeta>) : { projects: [], labels: [] }))
    .catch(() => ({ projects: [], labels: [] }));
  return cache;
}
