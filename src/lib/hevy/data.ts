import "server-only";
import { features } from "@/lib/config";
import { buildStrengthSeries, dayOffset, sampleTraining, type HealthWorkout, type TrainingData } from "@/lib/health";
import { isoDateInZone } from "@/lib/time";
import { getHevyExerciseTemplate, getHevyRoutinePage, getHevyWeightUnit, getHevyWorkoutCount, getHevyWorkoutPage, HevyError, type HevyExerciseTemplate, type HevyPage, type HevyWorkout } from "./client";

interface Snapshot {
  workouts: HevyWorkout[];
  templates: Map<string, HevyExerciseTemplate>;
  routines: TrainingData["routines"];
  weightUnit: "kg" | "lbs";
  syncedAt: string;
  warning: string | null;
  templatesAt: number;
}
const FRESH_MS = 5 * 60_000;
const STALE_MS = 24 * 60 * 60_000;
let cached: Snapshot | null = null;
let pending: Promise<Snapshot> | null = null;
let retryAt = 0;
let failed = false;

/** Four concurrent reads at most; a failed optional lookup doesn't lose workouts. */
async function concurrent<T, R>(items: T[], run: (value: T) => Promise<R>): Promise<R[]> {
  const result: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, async () => {
    while (next < items.length) { const i = next++; result[i] = await run(items[i]); }
  }));
  return result;
}

async function allPages<T>(read: (page: number) => Promise<HevyPage<T>>, maxPages: number): Promise<T[]> {
  const first = await read(1);
  if (first.pageCount > maxPages) throw new HevyError("invalid_response");
  const rest = await concurrent(Array.from({ length: Math.max(0, first.pageCount - 1) }, (_, i) => i + 2), read);
  if (rest.some((page) => page.pageCount !== first.pageCount)) throw new HevyError("invalid_response");
  return [...first.items, ...rest.flatMap((page) => page.items)];
}

async function refresh(): Promise<Snapshot> {
  const [records, count] = await Promise.all([allPages(getHevyWorkoutPage, 100), getHevyWorkoutCount()]);
  const workouts = [...new Map(records.map((w) => [w.id, w])).values()].sort((a, b) => b.start_time.localeCompare(a.start_time));
  // A changed account during paging must not masquerade as complete history.
  if (workouts.length !== count) throw new HevyError("invalid_response");
  const ids = [...new Set(workouts.flatMap((w) => w.exercises.map((e) => e.exercise_template_id)))];
  const existingTemplates = cached && Date.now() - cached.templatesAt < 60 * 60_000 ? cached : null;
  const templates = existingTemplates ? new Map(existingTemplates.templates) : new Map<string, HevyExerciseTemplate>();
  const missing = ids.filter((id) => !templates.has(id));
  const lookedUp = await concurrent(missing, (id) => getHevyExerciseTemplate(id).catch(() => null));
  for (const template of lookedUp) if (template) templates.set(template.id, template);
  const [routines, unit] = await Promise.allSettled([allPages(getHevyRoutinePage, 20), getHevyWeightUnit()]);
  return { workouts, templates, templatesAt: existingTemplates?.templatesAt ?? Date.now(),
    routines: routines.status === "fulfilled" ? routines.value.map((r) => ({ id: r.id, name: r.title, exercises: r.exercises.length })) : null,
    weightUnit: unit.status === "fulfilled" ? unit.value : "kg", syncedAt: new Date().toISOString(),
    warning: ids.some((id) => !templates.has(id)) ? "Some exercise information is unavailable; muscle totals and strength trends may be incomplete."
      : routines.status === "rejected" ? "Saved routines could not be loaded." : unit.status === "rejected" ? "Hevy’s preferred units could not be loaded; showing kilograms." : null };
}

export function normalizeWorkouts(snapshot: Pick<Snapshot, "workouts" | "templates">, today: string, timezone: string): HealthWorkout[] {
  return snapshot.workouts.map((w) => {
    const date = isoDateInZone(new Date(w.start_time), timezone);
    return { id: w.id, title: w.title, date, notes: w.description ?? undefined,
      daysAgo: Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86400_000),
      minutes: Math.round((Date.parse(w.end_time) - Date.parse(w.start_time)) / 60_000),
      exercises: [...w.exercises].sort((a, b) => a.index - b.index).map((e) => {
        const template = snapshot.templates.get(e.exercise_template_id);
        return { id: e.exercise_template_id, name: e.title, kind: template?.type, muscle: template?.primary_muscle_group, notes: e.notes ?? undefined,
          sets: [...e.sets].sort((a, b) => a.index - b.index).map((s) => ({ weight: s.weight_kg, reps: s.reps, type: s.type, duration: s.duration_seconds, distance: s.distance_meters, rpe: s.rpe })) };
      }) };
  }).filter((w) => w.date <= today).sort((a, b) => a.daysAgo - b.daysAgo);
}

/** RAM only: no workout files, Redis records, browser cache, or credential props. */
export async function getHevyTraining(today: string, timezone: string): Promise<TrainingData> {
  if (!features.hevy) return sampleTraining(today);
  const now = Date.now();
  if ((!cached || now - Date.parse(cached.syncedAt) >= FRESH_MS) && now >= retryAt) {
    try {
      pending ??= refresh();
      cached = await pending;
      failed = false;
    } catch (error) {
      failed = true;
      retryAt = Date.now() + 60_000;
      if (error instanceof HevyError && error.code === "authentication") cached = null;
    } finally { pending = null; }
  }
  if (!cached || now - Date.parse(cached.syncedAt) > STALE_MS) return { source: "unavailable", workouts: [], lifts: [], routines: null, weightUnit: "kg", syncedAt: null, message: "Hevy couldn’t load your training data. Your check-ins still work; we’ll retry automatically." };
  const workouts = normalizeWorkouts(cached, today, timezone);
  return { source: failed ? "cached" : "live", workouts, lifts: buildStrengthSeries(workouts.filter((w) => w.date! >= dayOffset(today, -84))), routines: cached.routines,
    weightUnit: cached.weightUnit, syncedAt: cached.syncedAt, message: failed ? "Hevy couldn’t refresh. Showing your last successful sync." : cached.warning };
}
