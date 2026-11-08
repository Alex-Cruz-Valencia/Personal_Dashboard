import { TRAINING_DAYS_PER_WEEK } from "./health-schedule";
import { PERSONAL_NUTRITION_GOALS, validNutritionGoals, type NutritionGoals } from "./nutrition";

/** Provider-independent health view model. Sample records never masquerade as connected data. */
export interface ExerciseSet {
  weight: number | null;
  reps: number | null;
  type?: "normal" | "warmup" | "dropset" | "failure";
  duration?: number | null;
  distance?: number | null;
  rpe?: number | null;
}
export interface HealthExercise { id?: string; name: string; kind?: string; muscle?: string; notes?: string; sets: ExerciseSet[] }
export interface HealthWorkout {
  id: string;
  title: string;
  daysAgo: number;
  minutes: number;
  exercises: HealthExercise[];
  date?: string;
  notes?: string;
}
export interface StrengthPoint { date: string; value: number }
export interface StrengthSeries { id: string; name: string; reps: number | null; metric: "load" | "reps"; points: StrengthPoint[] }
export interface TrainingData {
  source: "sample" | "live" | "cached" | "unavailable";
  workouts: HealthWorkout[];
  lifts: StrengthSeries[];
  routines: Array<{ id: string; name: string; exercises: number }> | null;
  weightUnit: "kg" | "lbs";
  syncedAt: string | null;
  message: string | null;
}
export interface HealthGoals { sessions: number; sleep: number; steps: number; water: number }
export interface HealthCheckin {
  energy: number;
  soreness: "low" | "moderate" | "high";
  sleep: number;
  steps: number | null;
  water: number;
  note: string;
}
export const HEALTH_GOALS: HealthGoals = { sessions: TRAINING_DAYS_PER_WEEK, sleep: 8, steps: 8000, water: 2500 };
export const HEALTH_STORAGE_KEY = "dashboard_health_v1";
export type TodayWorkoutPlan = { kind: "rest" } | { kind: "routine"; routineId: string; title: string };
export function validWorkoutPlan(value: unknown): value is TodayWorkoutPlan {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.kind === "rest" || (v.kind === "routine" && typeof v.routineId === "string" && v.routineId.length > 0 && v.routineId.length <= 100 && typeof v.title === "string" && v.title.trim().length > 0 && v.title.length <= 300);
}
export interface HealthJournal { nutritionGoalVersion?: 1; trainingScheduleVersion?: 1; workoutPlans?: Record<string, TodayWorkoutPlan>; nutritionGoals?: NutritionGoals; waterDays?: Record<string, number>; bottleMl?: number; goals: HealthGoals; days: Record<string, HealthCheckin> }

const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validCheckin(value: unknown): value is HealthCheckin {
  if (!value || typeof value !== "object") return false;
  const v = value as HealthCheckin;
  return inRange(v.energy, 1, 5) && Number.isInteger(v.energy)
    && ["low", "moderate", "high"].includes(v.soreness)
    && inRange(v.sleep, 0, 24) && (v.steps === null || (inRange(v.steps, 0, 100000) && Number.isInteger(v.steps)))
    && inRange(v.water, 0, 20000) && typeof v.note === "string" && v.note.length <= 500;
}

export function validGoals(value: unknown): value is HealthGoals {
  if (!value || typeof value !== "object") return false;
  const v = value as HealthGoals;
  return inRange(v.sessions, 1, 7) && Number.isInteger(v.sessions)
    && inRange(v.sleep, 1, 24) && inRange(v.steps, 100, 100000) && Number.isInteger(v.steps)
    && inRange(v.water, 100, 20000);
}

/** Treat browser storage as untrusted; retain valid days even if one record is damaged. */
export function readHealthJournal(raw: string | null): HealthJournal {
  const empty = { goals: { ...HEALTH_GOALS }, nutritionGoals: { ...PERSONAL_NUTRITION_GOALS }, days: {} };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return empty;
    const days = Object.fromEntries(Object.entries(parsed.days && typeof parsed.days === "object" ? parsed.days : {})
      .filter(([date, value]) => isIsoDate(date) && validCheckin(value))
      .sort(([a], [b]) => b.localeCompare(a)).slice(0, 90)) as Record<string, HealthCheckin>;
    const workoutPlans = Object.fromEntries(Object.entries(parsed.workoutPlans && typeof parsed.workoutPlans === "object" ? parsed.workoutPlans : {})
      .filter(([date, value]) => isIsoDate(date) && validWorkoutPlan(value))
      .sort(([a], [b]) => b.localeCompare(a)).slice(0, 90)) as Record<string, TodayWorkoutPlan>;
    const waterDays = Object.fromEntries(Object.entries(parsed.waterDays && typeof parsed.waterDays === "object" ? parsed.waterDays : {})
      .filter(([date, value]) => isIsoDate(date) && inRange(value, 0, 20000))
      .sort(([a], [b]) => b.localeCompare(a)).slice(0, 90)) as Record<string, number>;
    const previousGoals = validGoals(parsed.goals) ? parsed.goals : empty.goals;
    const goals = { ...previousGoals, sessions: parsed.trainingScheduleVersion === 1 ? previousGoals.sessions : TRAINING_DAYS_PER_WEEK };
    const previousNutrition = validNutritionGoals(parsed.nutritionGoals) ? parsed.nutritionGoals : PERSONAL_NUTRITION_GOALS;
    const nutritionGoals = parsed.nutritionGoalVersion === 1 ? previousNutrition : { ...previousNutrition, ...PERSONAL_NUTRITION_GOALS };
    return { nutritionGoals, ...(parsed.nutritionGoalVersion === 1 ? { nutritionGoalVersion: 1 as const } : {}), ...(parsed.trainingScheduleVersion === 1 ? { trainingScheduleVersion: 1 as const } : {}), ...(Object.keys(workoutPlans).length ? { workoutPlans } : {}), ...(Object.keys(waterDays).length ? { waterDays } : {}), goals, days, ...([355, 500, 710, 946, 1000].includes(parsed.bottleMl) ? { bottleMl: parsed.bottleMl } : {}) };
  } catch { return empty; }
}

export function workoutVolume(workout: HealthWorkout): number {
  return workout.exercises.reduce((total, exercise) => total + (exercise.kind === "bodyweight_assisted_reps" ? 0 : exercise.sets.reduce((sum, set) => sum + (set.type !== "warmup" && set.weight !== null && set.weight > 0 && set.reps !== null ? set.weight * set.reps : 0), 0)), 0);
}
export function workoutSets(workout: HealthWorkout): number {
  return workout.exercises.reduce((total, exercise) => total + exercise.sets.filter((set) => set.type !== "warmup").length, 0);
}
export const displayWeight = (kg: number, unit: "kg" | "lbs") => Math.round(kg * (unit === "lbs" ? 2.2046226218 : 1) * 10) / 10;

/** Compare the same exercise AND rep count; no estimated 1RM or invented weekly points. */
export function buildStrengthSeries(workouts: HealthWorkout[]): StrengthSeries[] {
  const groups = new Map<string, StrengthSeries>();
  for (const workout of workouts) for (const exercise of workout.exercises) {
    const load = ["weight_reps", "bodyweight_reps"].includes(exercise.kind ?? "");
    const repsOnly = exercise.kind === "reps_only";
    if (!workout.date || !exercise.id || (!load && !repsOnly)) continue;
    for (const set of exercise.sets) {
      if (set.type === "warmup" || set.reps === null || set.reps <= 0 || (load && (set.weight === null || set.weight <= 0))) continue;
      const id = `${exercise.id}:${load ? set.reps : "reps"}`;
      const group = groups.get(id) ?? { id, name: exercise.name, reps: load ? set.reps : null, metric: load ? "load" : "reps", points: [] };
      const value = load ? set.weight! : set.reps;
      const existing = group.points.find((p) => p.date === workout.date);
      if (existing) existing.value = Math.max(existing.value, value);
      else group.points.push({ date: workout.date, value });
      groups.set(id, group);
    }
  }
  return [...groups.values()].map((series) => ({ ...series, points: series.points.sort((a, b) => a.date.localeCompare(b.date)) }))
    .sort((a, b) => b.points.at(-1)!.date.localeCompare(a.points.at(-1)!.date) || b.points.length - a.points.length || a.name.localeCompare(b.name));
}

export function muscleSets(workouts: HealthWorkout[]): Array<{ muscle: string; sets: number }> {
  const result = new Map<string, number>();
  for (const workout of workouts) for (const exercise of workout.exercises) {
    if (!["weight_reps", "reps_only", "bodyweight_reps", "bodyweight_assisted_reps"].includes(exercise.kind ?? "")) continue;
    const count = exercise.sets.filter((s) => s.type !== "warmup" && s.reps !== null && s.reps > 0).length;
    if (count) result.set(exercise.muscle ?? "Uncategorized", (result.get(exercise.muscle ?? "Uncategorized") ?? 0) + count);
  }
  return [...result].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets);
}

export function sampleTraining(today: string): TrainingData {
  return { source: "sample", workouts: SAMPLE_WORKOUTS.map((w) => ({ ...w, date: dayOffset(today, -w.daysAgo) })),
    lifts: SAMPLE_LIFTS.map((lift) => ({ id: lift.name, name: lift.name, reps: lift.reps, metric: "load", points: lift.values.map((value, i) => ({ date: dayOffset(today, -(lift.values.length - 1 - i) * 7), value })) })),
    routines: null, weightUnit: "kg", syncedAt: null, message: null };
}
export function hoursLabel(hours: number): string {
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
}
export function dayOffset(iso: string, offset: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export function healthDate(iso: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
}

const sets = (weight: number, reps: number, count = 3): ExerciseSet[] => Array.from({ length: count }, () => ({ weight, reps }));
export const SAMPLE_WORKOUTS: HealthWorkout[] = [
  { id: "sample-upper-b", title: "Upper body B", daysAgo: 1, minutes: 58, exercises: [
    { name: "Bench press", sets: sets(62.5, 8) }, { name: "Seated cable row", sets: sets(55, 10) },
    { name: "Overhead press", sets: sets(35, 8) }, { name: "Lat pulldown", sets: sets(50, 10) },
    { name: "Lateral raise", sets: sets(10, 12) }, { name: "Triceps pushdown", sets: sets(25, 12) },
  ] },
  { id: "sample-lower-a", title: "Lower body A", daysAgo: 3, minutes: 64, exercises: [
    { name: "Squat", sets: sets(80, 6, 4) }, { name: "Romanian deadlift", sets: sets(70, 8) },
    { name: "Leg press", sets: sets(120, 10) }, { name: "Leg curl", sets: sets(35, 12) },
    { name: "Calf raise", sets: sets(40, 15) },
  ] },
  { id: "sample-upper-a", title: "Upper body A", daysAgo: 5, minutes: 55, exercises: [
    { name: "Bench press", sets: sets(60, 8) }, { name: "Seated cable row", sets: sets(52.5, 10) },
    { name: "Incline dumbbell press", sets: sets(22, 10) }, { name: "Lat pulldown", sets: sets(50, 10) },
    { name: "Biceps curl", sets: sets(12, 12) },
  ] },
];
export const SAMPLE_LIFTS = [
  { name: "Bench press", reps: 8, values: [50, 50, 52.5, 52.5, 55, 55, 57.5, 57.5, 60, 60, 60, 62.5] },
  { name: "Squat", reps: 6, values: [60, 62.5, 65, 65, 67.5, 70, 70, 72.5, 75, 75, 77.5, 80] },
  { name: "Romanian deadlift", reps: 8, values: [50, 50, 52.5, 55, 55, 57.5, 60, 60, 62.5, 65, 67.5, 70] },
];
export const SAMPLE_SLEEP = [7, 7.5, 6.5, 8, 7.25, 8.25, 7.5];
