import "server-only";
import { config, features } from "@/lib/config";

const API = "https://api.hevyapp.com/v1";
const TIMEOUT_MS = 10_000;
type Failure = "not_configured" | "disabled" | "authentication" | "rate_limited" | "unavailable" | "invalid_response";

export class HevyError extends Error {
  constructor(public readonly code: Failure) {
    super(`Hevy: ${code}`);
    this.name = "HevyError";
  }
}

export interface HevySet {
  index: number;
  type: "normal" | "warmup" | "dropset" | "failure";
  weight_kg: number | null;
  reps: number | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  rpe?: number | null;
  custom_metric?: number | null;
}
export interface HevyExercise {
  index: number;
  title: string;
  exercise_template_id: string;
  notes?: string | null;
  superset_id?: number | null;
  sets: HevySet[];
}
export interface HevyWorkout {
  id: string;
  title: string;
  routine_id?: string | null;
  description?: string | null;
  start_time: string;
  end_time: string;
  exercises: HevyExercise[];
}
/** Routine fields used by the health view; logged workouts remain separate. */
export interface HevyRoutine {
  id: string;
  title: string;
  exercises: Array<{ title: string; exercise_template_id: string; rest_seconds?: number | null; sets: unknown[] }>;
}
export interface HevyExerciseTemplate {
  id: string;
  title: string;
  type: string;
  primary_muscle_group: string;
  secondary_muscle_groups: string[];
  equipment: string;
  is_custom: boolean;
}
export interface HevyPage<T> { page: number; pageCount: number; items: T[] }

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string";
const number = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const count = (v: unknown): v is number => number(v) && Number.isInteger(v) && v >= 0;
const nullableNumber = (v: unknown) => v === null || number(v);
const timestamp = (v: unknown): v is string => text(v) && /(?:Z|[+-]\d{2}:\d{2})$/i.test(v) && Number.isFinite(Date.parse(v));

function isSet(v: unknown): v is HevySet {
  return object(v) && count(v.index) && text(v.type) && ["normal", "warmup", "dropset", "failure"].includes(v.type)
    && nullableNumber(v.weight_kg) && (v.reps === null || count(v.reps))
    && (v.distance_meters === null || (number(v.distance_meters) && v.distance_meters >= 0))
    && (v.duration_seconds === null || (number(v.duration_seconds) && v.duration_seconds >= 0))
    && (v.rpe == null || (number(v.rpe) && v.rpe >= 0 && v.rpe <= 10))
    && (v.custom_metric == null || number(v.custom_metric));
}
function isWorkout(v: unknown): v is HevyWorkout {
  return object(v) && text(v.id) && text(v.title) && timestamp(v.start_time) && timestamp(v.end_time)
    && Date.parse(v.end_time) >= Date.parse(v.start_time)
    && (v.routine_id == null || text(v.routine_id)) && (v.description == null || text(v.description))
    && Array.isArray(v.exercises) && v.exercises.every((e) => object(e) && count(e.index)
      && text(e.title) && text(e.exercise_template_id) && (e.notes == null || text(e.notes))
      && (e.superset_id == null || number(e.superset_id)) && Array.isArray(e.sets) && e.sets.every(isSet));
}
function isRoutine(v: unknown): v is HevyRoutine {
  return object(v) && text(v.id) && text(v.title) && Array.isArray(v.exercises)
    && v.exercises.every((e) => object(e) && text(e.title) && text(e.exercise_template_id)
      && (e.rest_seconds == null || count(e.rest_seconds)) && Array.isArray(e.sets));
}
function isTemplate(v: unknown): v is HevyExerciseTemplate {
  return object(v) && text(v.id) && text(v.title) && text(v.type) && text(v.primary_muscle_group)
    && Array.isArray(v.secondary_muscle_groups) && v.secondary_muscle_groups.every(text)
    && text(v.equipment) && typeof v.is_custom === "boolean";
}

/** Fixed origin, GET only, no redirects, no upstream errors or keys in logs/responses. */
async function read(path: string): Promise<unknown> {
  if (!config.hevy.apiKey) throw new HevyError("not_configured");
  if (!features.hevy) throw new HevyError("disabled");
  try {
    const response = await fetch(`${API}${path}`, {
      method: "GET",
      headers: { "api-key": config.hevy.apiKey, Accept: "application/json" },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 401 || response.status === 403) throw new HevyError("authentication");
    if (response.status === 429) throw new HevyError("rate_limited");
    if (!response.ok) throw new HevyError("unavailable");
    try { return await response.json(); } catch { throw new HevyError("invalid_response"); }
  } catch (error) {
    // Fetch errors can include request details. Replace them, never forward or log them.
    if (error instanceof HevyError) throw error;
    throw new HevyError("unavailable");
  }
}

export async function getHevyWorkoutCount(): Promise<number> {
  const data = await read("/workouts/count");
  if (!object(data) || !count(data.workout_count)) throw new HevyError("invalid_response");
  return data.workout_count;
}

async function readPage<T>(path: string, field: string, valid: (value: unknown) => value is T, page: number): Promise<HevyPage<T>> {
  if (!Number.isSafeInteger(page) || page < 1) throw new HevyError("invalid_response");
  const data = await read(`${path}?page=${page}&pageSize=10`);
  if (!object(data) || data.page !== page || !count(data.page_count) || !Array.isArray(data[field])) throw new HevyError("invalid_response");
  const items = data[field] as unknown[];
  if (items.length > 10 || !items.every(valid) || (items.length > 0 && data.page_count < page)) throw new HevyError("invalid_response");
  return { page, pageCount: data.page_count, items };
}

// Paging is explicit so callers can bound the history they import instead of
// silently showing a partial history as complete or making unlimited requests.
export const getHevyWorkoutPage = (page = 1) => readPage("/workouts", "workouts", isWorkout, page);
export const getHevyRoutinePage = (page = 1) => readPage("/routines", "routines", isRoutine, page);
export const getHevyExerciseTemplatePage = (page = 1) => readPage("/exercise_templates", "exercise_templates", isTemplate, page);

export async function getHevyExerciseTemplate(id: string): Promise<HevyExerciseTemplate> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new HevyError("invalid_response");
  const data = await read(`/exercise_templates/${encodeURIComponent(id)}`);
  if (!isTemplate(data)) throw new HevyError("invalid_response");
  return data;
}

export async function getHevyWeightUnit(): Promise<"kg" | "lbs"> {
  const data = await read("/user/info");
  if (!object(data) || !object(data.data) || !["kg", "lbs"].includes(String(data.data.weight_unit))) throw new HevyError("invalid_response");
  return data.data.weight_unit as "kg" | "lbs";
}
