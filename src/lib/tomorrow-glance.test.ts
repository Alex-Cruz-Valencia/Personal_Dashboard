import { describe, expect, it } from "vitest";
import { tomorrowGlance } from "./tomorrow-glance";
import type { AgendaEvent, WeekDay, WeekTask } from "./types";

const ev = (name: string, start: number, extra: Partial<AgendaEvent> = {}): AgendaEvent => ({ name, where: "", start, end: start + 1, kind: "meeting", ...extra });
const task = (name: string, priority: 1 | 2 | 3, dueHour: number | null = null): WeekTask => ({ name, priority, dueHour });
const day = (events: AgendaEvent[] | null, tasks: WeekTask[] | null): WeekDay => ({
  iso: "2026-11-07", name: "Sat", date: "7", isToday: false, bookedHours: null, eventCount: null, tasksDue: null, heavy: false, events, tasks,
});
const forecast = { high: 48, low: 31, condition: "Light rain", rainChance: 70 };

describe("tomorrowGlance", () => {
  it("names the first timed event, skipping all-day and free ones", () => {
    const lines = tomorrowGlance(day([ev("Banner", 0, { allDay: true }), ev("Hold", 8, { free: true }), ev("Lab", 13), ev("Standup", 9)], null), undefined, false);
    expect(lines).toEqual([{ kind: "first", label: "First", text: "9:00am Standup · 2 events" }]);
  });

  it("says nothing is booked when the calendar is readable and empty", () => {
    expect(tomorrowGlance(day([], null), undefined, false)[0].text).toBe("Nothing booked");
  });

  it("leaves out the calendar line when the calendar couldn't be read", () => {
    expect(tomorrowGlance(day(null, null), undefined, false)).toEqual([]);
  });

  it("adds rain only when it's likely", () => {
    expect(tomorrowGlance(null, forecast, false)[0].text).toBe("48° / 31°, light rain, 70% rain");
    expect(tomorrowGlance(null, { ...forecast, rainChance: 10 }, false)[0].text).toBe("48° / 31°, light rain");
  });

  it("picks the most urgent task, then the earliest", () => {
    const lines = tomorrowGlance(day(null, [task("Someday", 3), task("Late urgent", 1, 16), task("Early urgent", 1, 9)]), undefined, false);
    expect(lines[0].text).toBe("Early urgent · 9:00am (+2 more)");
  });
});
