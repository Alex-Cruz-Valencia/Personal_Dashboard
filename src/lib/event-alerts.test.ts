import { describe, expect, it } from "vitest";
import { alertBody, alertKey, dueAlerts, safeLink } from "./event-alerts";
import type { AgendaEvent } from "./types";

const ev = (name: string, start: number, extra: Partial<AgendaEvent> = {}): AgendaEvent => ({ id: name, name, start, end: start + 1, kind: "meeting", where: "", ...extra });
const names = (list: AgendaEvent[]) => list.map((e) => e.name);
const none = new Set<string>();

describe("dueAlerts", () => {
  it("takes what starts within ten minutes", () => {
    expect(names(dueAlerts([ev("Soon", 9.1), ev("Later", 9.5), ev("Over", 8.9)], 9, "d", none))).toEqual(["Soon"]);
  });

  it("alerts once", () => {
    const e = ev("Soon", 9.1);
    expect(dueAlerts([e], 9, "d", new Set([alertKey("d", e)]))).toEqual([]);
  });

  it("alerts again when an event moves", () => {
    const sent = new Set([alertKey("d", ev("Soon", 9.1))]);
    expect(names(dueAlerts([ev("Soon", 9.15)], 9, "d", sent))).toEqual(["Soon"]);
  });

  it("skips free and all-day events", () => {
    expect(dueAlerts([ev("Hold", 9.1, { free: true }), ev("Trip", 9.1, { allDay: true })], 9, "d", none)).toEqual([]);
  });
});

it("says when and where", () => {
  expect(alertBody(ev("A", 14, { location: "Room 2" }), 13.9, false)).toBe("In 6 min, 2:00pm · Room 2");
  expect(alertBody(ev("A", 14), 14, true)).toContain("Starting now");
});

it("only opens https links", () => {
  expect(safeLink("https://meet.google.com/x")).toBeDefined();
  expect(safeLink("javascript:alert(1)")).toBeUndefined();
  expect(safeLink(undefined)).toBeUndefined();
});
