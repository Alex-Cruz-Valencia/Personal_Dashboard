import { describe, expect, it } from "vitest";
import { pickWaiting, type MailLite } from "./waiting";

const ME = "me@x.com";
const NOW = Date.parse("2026-11-07T12:00:00Z");
const daysAgo = (d: number) => NOW - d * 86_400_000;
const mail = (over: Partial<MailLite>): MailLite => ({
  from: `Alex <${ME}>`, to: '"Priya Raman" <priya@y.com>', subject: "Lab schedule", snippet: "Could you send the slots?", at: daysAgo(4), ...over,
});

describe("pickWaiting", () => {
  it("keeps a question I sent days ago with no answer", () => {
    expect(pickWaiting([{ id: "t1", messages: [mail({})] }], ME, NOW)).toEqual([{ id: "t1", to: "Priya Raman", subject: "Lab schedule", days: 4 }]);
  });

  it("drops a thread once they've answered", () => {
    const reply = mail({ from: "priya@y.com", to: ME, at: daysAgo(3) });
    expect(pickWaiting([{ id: "t1", messages: [mail({}), reply] }], ME, NOW)).toEqual([]);
  });

  it("ignores my unsent drafts when finding the last message", () => {
    const reply = mail({ from: "priya@y.com", to: ME, at: daysAgo(3) });
    const draft = mail({ at: daysAgo(1), draft: true });
    expect(pickWaiting([{ id: "t1", messages: [mail({}), reply, draft] }], ME, NOW)).toEqual([]);
  });

  it("waits two days before calling it waiting, and lets go after three weeks", () => {
    expect(pickWaiting([{ id: "t1", messages: [mail({ at: daysAgo(1) })] }], ME, NOW)).toEqual([]);
    expect(pickWaiting([{ id: "t1", messages: [mail({ at: daysAgo(30) })] }], ME, NOW)).toEqual([]);
  });

  it("skips FYIs, notes to myself and no-reply addresses", () => {
    const fyi = mail({ subject: "Notes from today", snippet: "Here are the notes." });
    const self = mail({ to: ME });
    const bot = mail({ to: "noreply@service.com" });
    expect(pickWaiting([fyi, self, bot].map((m, i) => ({ id: `t${i}`, messages: [m] })), ME, NOW)).toEqual([]);
  });

  it("names the first person and counts the rest, oldest first", () => {
    const a = mail({ to: '"Sam Lee" <sam@y.com>, priya@y.com', at: daysAgo(3) });
    const b = mail({ at: daysAgo(9) });
    const out = pickWaiting([{ id: "a", messages: [a] }, { id: "b", messages: [b] }], ME, NOW);
    expect(out.map((w) => [w.id, w.to])).toEqual([["b", "Priya Raman"], ["a", "Sam Lee +1"]]);
  });
});
