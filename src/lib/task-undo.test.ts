import { describe, expect, it } from "vitest";
import { changeText, revertPatch, uncompleteRequest } from "./task-undo";
import type { Task } from "./types";

const task = (extra: Partial<Task> = {}): Task => ({ id: "t1", name: "T", priority: 2, meta: "", due: "", dueHour: null, ...extra });

describe("revertPatch", () => {
  it("moves a date back to the old day", () => {
    expect(revertPatch(task({ dueDate: "2026-11-01" }), { date: "2026-11-02" })).toEqual({ date: "2026-11-01" });
  });

  it("takes a date off a task that had none", () => {
    expect(revertPatch(task(), { date: "2026-11-02" })).toEqual({ date: null });
  });

  it("brings back the repeat when a date is cleared", () => {
    expect(revertPatch(task({ dueDate: "2026-11-01", isRecurring: true, recurrence: "every day" }), { date: null })).toEqual({ due: "every day" });
  });

  it("brings back the time when a date is cleared", () => {
    expect(revertPatch(task({ dueDate: "2026-11-01", dueHour: 14.5 }), { date: null })).toEqual({ due: "2026-11-01 14:30" });
  });

  it("restores priority, deadline and place", () => {
    expect(revertPatch(task({ todoistPriority: 2 }), { todoistPriority: 1 })).toEqual({ todoistPriority: 2 });
    expect(revertPatch(task(), { todoistPriority: 1 })).toEqual({ todoistPriority: 4 });
    expect(revertPatch(task({ deadline: "2026-11-05" }), { deadline: null })).toEqual({ deadline: "2026-11-05" });
    expect(revertPatch(task({ projectId: "p", sectionId: "s" }), { projectId: "q" })).toEqual({ sectionId: "s" });
    expect(revertPatch(task({ projectId: "p" }), { sectionId: "s" })).toEqual({ projectId: "p" });
  });

  it("gives up on a field it can't reverse", () => {
    expect(revertPatch(task(), { content: "New" })).toBeNull();
  });
});

describe("uncompleteRequest", () => {
  it("reopens a one-off task", () => {
    expect(uncompleteRequest(task())).toEqual({ path: "/api/tasks/t1/reopen", method: "POST" });
  });

  it("puts a repeating task's date back instead", () => {
    expect(uncompleteRequest(task({ isRecurring: true, dueDate: "2026-11-01" }))).toEqual({ path: "/api/tasks/t1", method: "PATCH", body: { date: "2026-11-01" } });
  });
});

it("names each change", () => {
  expect(changeText({ date: null })).toBe("Date changed");
  expect(changeText({ projectId: "p" })).toBe("Task moved");
});
