import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const settings = vi.hoisted(() => ({ config: { hevy: { apiKey: "test-only-key" } }, features: { hevy: true } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => settings);

import { getHevyExerciseTemplatePage, getHevyRoutinePage, getHevyWorkoutCount, getHevyWorkoutPage } from "./client";
import { GET } from "@/app/api/health/hevy/route";

const fetchMock = vi.fn();
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const request = () => new Request("http://localhost:3000/api/health/hevy", { headers: { host: "localhost:3000" } });
const workout = {
  id: "workout-1", title: "Upper", start_time: "2026-11-07T14:00:00Z", end_time: "2026-11-07T15:00:00Z",
  exercises: [{ index: 0, title: "Bench", exercise_template_id: "bench", sets: [
    { index: 0, type: "warmup", weight_kg: 20, reps: 10, distance_meters: null, duration_seconds: null, rpe: null },
    { index: 1, type: "normal", weight_kg: 60, reps: 8, distance_meters: null, duration_seconds: null, rpe: 8.5 },
  ] }],
};

beforeEach(() => {
  settings.config.hevy.apiKey = "test-only-key";
  settings.features.hevy = true;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("read-only Hevy client", () => {
  it("sends the key in the header to the fixed origin, with no redirects or persistent caching", async () => {
    fetchMock.mockResolvedValue(response({ workout_count: 0 }));
    expect(await getHevyWorkoutCount()).toBe(0);
    expect(fetchMock).toHaveBeenCalledWith("https://api.hevyapp.com/v1/workouts/count", expect.objectContaining({
      method: "GET", headers: { "api-key": "test-only-key", Accept: "application/json" }, redirect: "error", cache: "no-store", signal: expect.any(AbortSignal),
    }));
  });
  it("does not contact Hevy without a key or while demo mode is forced", async () => {
    settings.config.hevy.apiKey = "";
    await expect(getHevyWorkoutCount()).rejects.toMatchObject({ code: "not_configured" });
    settings.config.hevy.apiKey = "test-only-key";
    settings.features.hevy = false;
    await expect(getHevyWorkoutCount()).rejects.toMatchObject({ code: "disabled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("preserves set types, nullable metrics, and explicit pagination", async () => {
    fetchMock.mockResolvedValue(response({ page: 2, page_count: 3, workouts: [workout] }));
    expect(await getHevyWorkoutPage(2)).toEqual({ page: 2, pageCount: 3, items: [workout] });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.hevyapp.com/v1/workouts?page=2&pageSize=10");
  });
  it("accepts an empty workout history without manufacturing sample records", async () => {
    fetchMock.mockResolvedValue(response({ page: 1, page_count: 0, workouts: [] }));
    expect((await getHevyWorkoutPage()).items).toEqual([]);
  });
  it("rejects malformed records and mismatched pages instead of reporting incomplete data as valid", async () => {
    for (const data of [
      { page: 1, page_count: 1, workouts: [{ ...workout, start_time: "bad" }] },
      { page: 2, page_count: 2, workouts: [workout] },
      { page: 1, page_count: 0, workouts: [workout] },
      { page: 1, page_count: 1, workouts: [{ ...workout, exercises: [{ ...workout.exercises[0], sets: [{}] }] }] },
    ]) {
      fetchMock.mockResolvedValueOnce(response(data));
      await expect(getHevyWorkoutPage()).rejects.toMatchObject({ code: "invalid_response" });
    }
    fetchMock.mockClear();
    await expect(getHevyWorkoutPage(-1)).rejects.toMatchObject({ code: "invalid_response" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reads routines and exercise metadata separately from completed workouts", async () => {
    fetchMock.mockResolvedValueOnce(response({ page: 1, page_count: 1, routines: [{ id: "routine-1", title: "Upper", exercises: [] }] }));
    expect((await getHevyRoutinePage()).items[0].id).toBe("routine-1");
    const template = { id: "bench", title: "Bench", type: "weight_reps", primary_muscle_group: "chest", secondary_muscle_groups: ["triceps"], equipment: "barbell", is_custom: false };
    fetchMock.mockResolvedValueOnce(response({ page: 1, page_count: 1, exercise_templates: [template] }));
    expect((await getHevyExerciseTemplatePage()).items).toEqual([template]);
  });
  it("sanitizes authorization, rate-limit, invalid JSON, and network errors", async () => {
    for (const [status, code] of [[401, "authentication"], [403, "authentication"], [429, "rate_limited"], [500, "unavailable"]] as const) {
      fetchMock.mockResolvedValueOnce(response({ error: "test-only-key" }, status));
      await expect(getHevyWorkoutCount()).rejects.toMatchObject({ code, message: `Hevy: ${code}` });
    }
    fetchMock.mockResolvedValueOnce(new Response("not JSON"));
    await expect(getHevyWorkoutCount()).rejects.toMatchObject({ code: "invalid_response" });
    fetchMock.mockRejectedValueOnce(new Error("request failed with test-only-key"));
    await expect(getHevyWorkoutCount()).rejects.toMatchObject({ message: "Hevy: unavailable" });
  });
});

describe("Hevy connection probe", () => {
  it("rejects requests from other websites before contacting Hevy", async () => {
    const res = await GET(new Request("http://localhost:3000/api/health/hevy", { headers: { host: "localhost:3000", origin: "https://elsewhere.example" } }));
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reports missing configuration and forced demo mode without exposing the key", async () => {
    settings.config.hevy.apiKey = "";
    expect(await (await GET(request())).json()).toMatchObject({ configured: false, connected: false, status: "not_configured" });
    settings.config.hevy.apiKey = "test-only-key";
    settings.features.hevy = false;
    expect(await (await GET(request())).json()).toMatchObject({ configured: true, connected: false, status: "disabled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns only safe connection metadata with private, no-store caching", async () => {
    fetchMock.mockResolvedValueOnce(response({ workout_count: 42 }));
    const res = await GET(request());
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toMatchObject({ connected: true, status: "connected", workoutCount: 42 });
    fetchMock.mockResolvedValueOnce(response({ error: "test-only-key" }, 401));
    const failed = await GET(request());
    expect(failed.status).toBe(502);
    expect(await failed.text()).not.toContain("test-only-key");
  });
});
