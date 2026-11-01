import { expect, it } from "vitest";
import { blockedTasks, isTaskBlock, taskMarker } from "./plan";
import type { AgendaEvent } from "./types";

const ev = (name: string, start: number, description?: string): AgendaEvent => ({ name, start, end: start + 1, kind: "focus", where: "", description });

it("finds which tasks are on the calendar", () => {
  const found = blockedTasks([ev("Later", 15, `Planned. ${taskMarker("a1")}`), ev("Sooner", 9, taskMarker("a1")), ev("Meeting", 10, "no marker")]);
  expect([...found.keys()]).toEqual(["a1"]);
  expect(found.get("a1")?.name).toBe("Sooner");
});

it("tells a task's block from an ordinary event", () => {
  expect(isTaskBlock(ev("Block", 9, taskMarker("a1")))).toBe(true);
  expect(isTaskBlock(ev("Meeting", 9, "Agenda attached"))).toBe(false);
  expect(isTaskBlock(ev("Lunch", 9))).toBe(false);
});
