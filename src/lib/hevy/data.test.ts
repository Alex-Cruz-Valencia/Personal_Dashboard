import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildStrengthSeries, displayWeight, muscleSets, workoutSets, workoutVolume } from "@/lib/health";
import type { HevyWorkout } from "./client";

const mocks = vi.hoisted(() => ({
  features: { hevy: true }, workouts: vi.fn(), count: vi.fn(), template: vi.fn(), routines: vi.fn(), unit: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({ features: mocks.features }));
vi.mock("./client", () => ({
  getHevyWorkoutPage: mocks.workouts, getHevyWorkoutCount: mocks.count, getHevyExerciseTemplate: mocks.template,
  getHevyRoutinePage: mocks.routines, getHevyWeightUnit: mocks.unit,
  HevyError: class extends Error { constructor(public code: string) { super(code); } },
}));

function workout(id = "one", date = "2026-11-07T00:30:00Z"): HevyWorkout {
  return { id, title: "Training", start_time: date, end_time: new Date(Date.parse(date) + 3600_000).toISOString(), exercises: [
    { index: 0, title: "Bench", exercise_template_id: "bench", notes: "Steady", sets: [
      { index: 0, type: "warmup", weight_kg: 100, reps: 8, distance_meters: null, duration_seconds: null },
      { index: 1, type: "normal", weight_kg: 60, reps: 8, rpe: 8, distance_meters: null, duration_seconds: null },
      { index: 2, type: "normal", weight_kg: 65, reps: 6, distance_meters: null, duration_seconds: null },
    ] },
  ] };
}
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-07T15:00:00Z"));
  mocks.features.hevy = true;
  for (const mock of [mocks.workouts, mocks.count, mocks.template, mocks.routines, mocks.unit]) mock.mockReset();
  mocks.workouts.mockResolvedValue({ page: 1, pageCount: 1, items: [workout()] });
  mocks.count.mockResolvedValue(1);
  mocks.template.mockResolvedValue({ id: "bench", title: "Bench", type: "weight_reps", primary_muscle_group: "chest", secondary_muscle_groups: ["triceps"], equipment: "barbell", is_custom: false });
  mocks.routines.mockResolvedValue({ page: 1, pageCount: 0, items: [] });
  mocks.unit.mockResolvedValue("lbs");
});
afterEach(() => vi.useRealTimers());

describe("Hevy normalization and derived metrics", () => {
  it("uses the viewer's local date and keeps varied sets, warm-ups and RPE intact", async () => {
    const { getHevyTraining } = await import("./data");
    const result = await getHevyTraining("2026-11-07", "America/Los_Angeles");
    expect(result.source).toBe("live");
    expect(result.weightUnit).toBe("lbs");
    const w = result.workouts[0];
    expect(w).toMatchObject({ date: "2026-11-06", daysAgo: 1, minutes: 60 });
    expect(w.exercises[0].sets.map((s) => s.reps)).toEqual([8, 8, 6]);
    expect(w.exercises[0].sets[1].rpe).toBe(8);
    expect(workoutSets(w)).toBe(2);
    expect(workoutVolume(w)).toBe(870);
    expect(muscleSets([w])).toEqual([{ muscle: "chest", sets: 2 }]);
    expect(result.lifts.map((s) => s.reps).sort()).toEqual([6, 8]);
    expect(result.lifts.find((s) => s.reps === 8)?.points[0].value).toBe(60);
    expect(displayWeight(60, "lbs")).toBe(132.3);
  });
  it("compares exact rep counts, never uses warm-ups or assistance as strength gains, and preserves sparse dates", async () => {
    const { getHevyTraining } = await import("./data");
    const data = await getHevyTraining("2026-11-07", "UTC");
    const w = data.workouts[0];
    const earlier = { ...w, id: "earlier", date: "2026-10-20", exercises: w.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, weight: s.weight! - 5 })) })) };
    const assisted = { ...w, id: "assist", exercises: w.exercises.map((e) => ({ ...e, id: "assisted", kind: "bodyweight_assisted_reps" })) };
    const series = buildStrengthSeries([w, earlier, assisted]);
    expect(series).toHaveLength(2);
    expect(series.find((s) => s.reps === 8)?.points).toEqual([{ date: "2026-10-20", value: 55 }, { date: "2026-11-07", value: 60 }]);
    expect(workoutVolume(assisted)).toBe(0);
  });
});

describe("Hevy synchronization", () => {
  it("loads every page and shares a five-minute in-memory cache across refreshes", async () => {
    mocks.workouts.mockImplementation(async (page) => ({ page, pageCount: 2, items: [workout(`workout-${page}`)] }));
    mocks.count.mockResolvedValue(2);
    const { getHevyTraining } = await import("./data");
    const [first, second] = await Promise.all([getHevyTraining("2026-11-07", "UTC"), getHevyTraining("2026-11-07", "UTC")]);
    expect(first.workouts).toHaveLength(2);
    expect(second.source).toBe("live");
    expect(mocks.workouts).toHaveBeenCalledTimes(2);
    await getHevyTraining("2026-11-07", "UTC");
    expect(mocks.workouts).toHaveBeenCalledTimes(2);
    expect(mocks.template).toHaveBeenCalledTimes(1);
  });
  it("shows a real empty account as empty and does not insert samples", async () => {
    mocks.workouts.mockResolvedValue({ page: 1, pageCount: 0, items: [] }); mocks.count.mockResolvedValue(0);
    const { getHevyTraining } = await import("./data");
    expect(await getHevyTraining("2026-11-07", "UTC")).toMatchObject({ source: "live", workouts: [], lifts: [] });
  });
  it("rejects incomplete or changing pagination instead of showing incorrect totals", async () => {
    mocks.count.mockResolvedValue(3);
    const { getHevyTraining } = await import("./data");
    expect(await getHevyTraining("2026-11-07", "UTC")).toMatchObject({ source: "unavailable", workouts: [] });
  });
  it("keeps workouts usable if optional exercise metadata or routines fail", async () => {
    mocks.template.mockRejectedValue(new Error("metadata unavailable")); mocks.routines.mockRejectedValue(new Error("routines unavailable"));
    const { getHevyTraining } = await import("./data");
    const data = await getHevyTraining("2026-11-07", "UTC");
    expect(data.source).toBe("live"); expect(data.workouts).toHaveLength(1); expect(data.routines).toBeNull(); expect(data.lifts).toEqual([]); expect(data.message).toContain("incomplete");
  });
  it("labels stale data, backs off retries, and clears cached history on authentication failure", async () => {
    const { getHevyTraining } = await import("./data");
    const first = await getHevyTraining("2026-11-07", "UTC");
    vi.advanceTimersByTime(5 * 60_000);
    mocks.workouts.mockRejectedValue(new Error("offline"));
    const stale = await getHevyTraining("2026-11-07", "UTC");
    expect(stale.source).toBe("cached"); expect(stale.syncedAt).toBe(first.syncedAt);
    const calls = mocks.workouts.mock.calls.length;
    await getHevyTraining("2026-11-07", "UTC"); expect(mocks.workouts).toHaveBeenCalledTimes(calls);
    const { HevyError } = await import("./client");
    mocks.workouts.mockRejectedValue(new HevyError("authentication")); vi.advanceTimersByTime(60_000);
    expect(await getHevyTraining("2026-11-07", "UTC")).toMatchObject({ source: "unavailable", workouts: [] });
  });
  it("does not contact Hevy when live integration is disabled", async () => {
    mocks.features.hevy = false;
    const { getHevyTraining } = await import("./data");
    expect((await getHevyTraining("2026-11-07", "UTC")).source).toBe("sample");
    expect(mocks.workouts).not.toHaveBeenCalled();
  });
});
