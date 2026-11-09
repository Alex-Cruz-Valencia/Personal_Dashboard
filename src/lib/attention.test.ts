import { describe, expect, it } from "vitest";
import { attentionChips, buildAttention, conflictSpans, freeSpans } from "./attention";
import type { AgendaEvent, Reply, Task } from "./types";

const ev = (name: string, start: number, end: number, extra: Partial<AgendaEvent> = {}): AgendaEvent => ({ name, start, end, kind: "meeting", where: "", ...extra });
const task = (overdueDays: number): Task => ({ name: "T", priority: 2, meta: "", due: "", dueHour: null, overdueDays });
const reply = (id: string, urgency: 1 | 2): Reply => ({ id, from: "A", subject: "S", age: "1h", note: "", urgency, unread: true });
const build = (agenda: AgendaEvent[], extra: { tasks?: Task[]; replies?: Reply[] } = {}) =>
  buildAttention({ agenda, tasks: extra.tasks ?? [], replies: extra.replies ?? [], nowHour: 9 });

describe("conflicts", () => {
  it("flags two different events that overlap", () => {
    expect(build([ev("A", 10, 11), ev("B", 10.5, 11.5)]).map((i) => i.kind)).toEqual(["conflict"]);
  });

  it("doesn't flag one meeting on two calendars against itself", () => {
    expect(build([ev("Team", 10, 11), ev("team ", 10, 11)])).toEqual([]);
    expect(conflictSpans([ev("Team", 10, 11), ev("Team", 10, 11)])).toEqual([]);
  });

  it("still flags the same name at different times", () => {
    expect(build([ev("Team", 10, 11), ev("Team", 10.5, 11.5)])).toHaveLength(1);
  });

  it("ignores an event marked free", () => {
    expect(build([ev("A", 10, 11), ev("Hold", 10, 11, { free: true })])).toEqual([]);
    expect(freeSpans([ev("Hold", 10, 11, { free: true })], 10, 11)).toHaveLength(1);
  });

  it("ignores what's already over", () => {
    expect(build([ev("A", 7, 8), ev("B", 7.5, 8.5)])).toEqual([]);
  });
});

describe("chips", () => {
  it("rolls items into one chip per kind, with real counts", () => {
    const chips = attentionChips(
      build([ev("A", 10, 11), ev("B", 10.5, 11.5), ev("C", 13, 14), ev("D", 13.5, 14.5)], {
        tasks: [task(1), task(2), task(3)],
        replies: [reply("x", 1), reply("y", 2), reply("z", 2)],
      }),
    );
    expect(chips.map((c) => `${c.count} ${c.label}`)).toEqual(["2 conflicts", "3 overdue", "1 blocking someone", "2 replies waiting"]);
  });

  it("uses the singular for one", () => {
    expect(attentionChips(build([ev("A", 10, 11), ev("B", 10.5, 11.5)]))[0].label).toBe("conflict");
  });
});

describe("waiting on others", () => {
  it("rolls sent emails into one chip, naming the longest wait", () => {
    const waiting = [
      { id: "a", to: "Sam", subject: "S", days: 3, url: "", lastId: "m1" },
      { id: "b", to: "Priya", subject: "P", days: 8, url: "", lastId: "m2" },
    ];
    const items = buildAttention({ agenda: [], tasks: [], replies: [], waiting, nowHour: 9 });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "waiting", count: 2, detail: "Longest: Priya, 8 days", waitingIds: ["a", "b"] });
    expect(attentionChips(items)[0].label).toBe("waiting on others");
  });
});
