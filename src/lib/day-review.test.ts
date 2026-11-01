import { describe, expect, it } from "vitest";
import { closingLine, firstUp, promptText, reviewMode, reviewTasks } from "./day-review";
import type { Task, WeekDay } from "./types";

const task = (id: string, overdueDays?: number): Task => ({ id, name: id, priority: 2, meta: "", due: "", dueHour: null, overdueDays });

describe("reviewMode", () => {
  it("turns to night at wind down", () => {
    expect(reviewMode(20.9, 21)).toBe("morning");
    expect(reviewMode(21, 21)).toBe("night");
  });
});

describe("reviewTasks", () => {
  const tasks = [task("today"), task("late", 1), task("later", 4), { ...task(""), id: undefined }];

  it("takes only what's late in the morning, oldest first", () => {
    expect(reviewTasks(tasks, "morning").map((t) => t.id)).toEqual(["later", "late"]);
  });

  it("takes everything still open at night", () => {
    expect(reviewTasks(tasks, "night").map((t) => t.id)).toEqual(["later", "late", "today"]);
  });
});

it("words the prompt for each time of day", () => {
  expect(promptText(1, "morning")).toBe("1 task is overdue.");
  expect(promptText(3, "morning")).toBe("3 tasks are overdue.");
  expect(promptText(2, "night")).toBe("2 tasks still open today. Plan them before tomorrow?");
});

describe("firstUp", () => {
  it("skips all-day events", () => {
    const day = { events: [{ name: "Trip", start: 0, end: 24, allDay: true }, { name: "B", start: 10, end: 11 }, { name: "A", start: 9, end: 10 }] } as unknown as WeekDay;
    expect(firstUp(day)).toEqual({ name: "A", start: 9 });
  });

  it("is null without a calendar", () => {
    expect(firstUp(null)).toBeNull();
  });
});

it("leaves empty counts out of the closing line", () => {
  expect(closingLine(2, 0, 1)).toBe("2 finished · 1 removed");
});
