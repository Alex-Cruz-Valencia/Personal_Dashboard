/** Provider-independent health view model. Sample records never masquerade as connected data. */
export interface ExerciseSet { weight: number; reps: number }
export interface HealthExercise { name: string; sets: ExerciseSet[] }
export interface HealthWorkout {
  id: string;
  title: string;
  daysAgo: number;
  minutes: number;
  exercises: HealthExercise[];
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
export const HEALTH_GOALS: HealthGoals = { sessions: 4, sleep: 8, steps: 8000, water: 2500 };
export const HEALTH_STORAGE_KEY = "dashboard_health_v1";
export interface HealthJournal { goals: HealthGoals; days: Record<string, HealthCheckin> }

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
    && inRange(v.water, 100, 20000) && Number.isInteger(v.water);
}

/** Treat browser storage as untrusted; retain valid days even if one record is damaged. */
export function readHealthJournal(raw: string | null): HealthJournal {
  const empty = { goals: { ...HEALTH_GOALS }, days: {} };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return empty;
    const days = Object.fromEntries(Object.entries(parsed.days && typeof parsed.days === "object" ? parsed.days : {})
      .filter(([date, value]) => isIsoDate(date) && validCheckin(value))
      .sort(([a], [b]) => b.localeCompare(a)).slice(0, 90)) as Record<string, HealthCheckin>;
    return { goals: validGoals(parsed.goals) ? parsed.goals : empty.goals, days };
  } catch { return empty; }
}

export function workoutVolume(workout: HealthWorkout): number {
  return workout.exercises.reduce((total, exercise) => total + exercise.sets.reduce((sum, set) => sum + set.weight * set.reps, 0), 0);
}
export function workoutSets(workout: HealthWorkout): number {
  return workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
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
