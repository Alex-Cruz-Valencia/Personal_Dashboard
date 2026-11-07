import { describe, expect, it } from "vitest";
import { dayOffset, HEALTH_GOALS, hoursLabel, readHealthJournal, validCheckin, validGoals, workoutVolume, type HealthCheckin } from "./health";

const checkin: HealthCheckin = { energy: 3, soreness: "low", sleep: 7.5, steps: null, water: 1250, note: "Felt good after a walk." };

describe("health journal", () => {
  it("recovers from corrupt and unexpected storage without losing the page", () => {
    for (const raw of [null, "{", "null", "42", "[]"]) {
      expect(readHealthJournal(raw)).toEqual({ goals: HEALTH_GOALS, days: {} });
    }
  });
  it("retains valid check-ins while rejecting impossible dates and invalid entries", () => {
    const journal = readHealthJournal(JSON.stringify({ goals: { sleep: -1 }, days: {
      "2026-11-07": checkin,
      "2026-11-08": { ...checkin, energy: 8 },
      "2026-02-30": checkin,
      "2026-13-01": checkin,
      "not-a-date": checkin,
    } }));
    expect(journal.goals).toEqual(HEALTH_GOALS);
    expect(journal.days).toEqual({ "2026-11-07": checkin });
  });
  it("retains the newest 90 days, regardless of insertion order", () => {
    const days = Object.fromEntries(Array.from({ length: 100 }, (_, index) => [dayOffset("2026-11-07", -index), checkin]).reverse());
    const journal = readHealthJournal(JSON.stringify({ goals: HEALTH_GOALS, days }));
    expect(Object.keys(journal.days)).toHaveLength(90);
    expect(journal.days["2026-11-07"]).toEqual(checkin);
    expect(journal.days[dayOffset("2026-11-07", -90)]).toBeUndefined();
  });
  it("distinguishes unlogged steps from a real zero and bounds numeric values", () => {
    expect(validCheckin(checkin)).toBe(true);
    expect(validCheckin({ ...checkin, steps: 0, sleep: 0 })).toBe(true);
    for (const patch of [{ steps: -1 }, { steps: 2.5 }, { energy: 3.5 }, { water: NaN }, { sleep: 25 }, { note: "a".repeat(501) }, { soreness: "unknown" }]) {
      expect(validCheckin({ ...checkin, ...patch })).toBe(false);
    }
  });
  it("rejects zero targets that would break progress calculations", () => {
    expect(validGoals(HEALTH_GOALS)).toBe(true);
    expect(validGoals({ ...HEALTH_GOALS, steps: 0 })).toBe(false);
    expect(validGoals({ ...HEALTH_GOALS, sessions: 3.5 })).toBe(false);
  });
});

describe("health display calculations", () => {
  it("counts each working set's actual load and reps", () => {
    expect(workoutVolume({ id: "test", title: "Test", daysAgo: 1, minutes: 10, exercises: [{ name: "Bench", sets: [{ weight: 60, reps: 8 }, { weight: 62.5, reps: 6 }] }] })).toBe(855);
  });
  it("keeps calendar dates stable across DST and rounds hours at minute boundaries", () => {
    expect(dayOffset("2026-11-01", -1)).toBe("2026-10-31");
    expect(dayOffset("2026-03-08", 1)).toBe("2026-03-09");
    expect(hoursLabel(7.999)).toBe("8h");
    expect(hoursLabel(7.5)).toBe("7h 30m");
  });
});
