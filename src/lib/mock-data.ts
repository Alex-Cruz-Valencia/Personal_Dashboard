/**
 * Frozen placeholder dataset — a 1:1 typed copy of the `DATA` block in the
 * Claude Design source ("Morning Dashboard v2.dc.html").
 *
 * This is the Phase 1 data layer and the fallback for every later phase: any
 * slice without a configured live source renders from here, so the dashboard
 * always has something to show and the reference design is reproduced exactly
 * out of the box.
 */

import type {
  AgendaEvent,
  ArcWindow,
  Reply,
  Task,
  TodayInfo,
  UserInfo,
  Weather,
} from "./types";

export const MOCK_USER: UserInfo = { name: "Ellis" };

/** Pinned so a zero-config install matches the reference pixel-for-pixel. */
export const MOCK_TODAY: TodayInfo = { iso: "2026-08-29", nowHour: 8.2 };

export const MOCK_WEATHER: Weather = {
  tempNow: 61,
  tempHigh: 74,
  tempLow: 55,
  condition: "Coastal fog, clearing by ten",
  sunrise: 6.4,
  sunset: 19.8,
  footnote: "No rain expected · Wind 7 mph NW",
};

export const MOCK_DAY_NOTE =
  "Three uninterrupted hours before your first meeting — the Kestrel draft is the only thing that fits there.";

export const MOCK_TASKS: Task[] = [
  { name: "Finish Kestrel launch draft", priority: 1, meta: "Kestrel", due: "11:00", dueHour: 11 },
  { name: "Sign the vendor renewal", priority: 1, meta: "Ops", due: "EOD", dueHour: 17 },
  { name: "Review Priya’s pricing model", priority: 2, meta: "Revenue", due: "14:00", dueHour: 14 },
  { name: "Book flights for the Austin offsite", priority: 2, meta: "Travel", due: "Today", dueHour: null },
  { name: "Reply to the design-system RFC", priority: 2, meta: "Platform", due: "Tomorrow", dueHour: null },
  { name: "Clear the reading list", priority: 3, meta: "Personal", due: "—", dueHour: null },
];

export const MOCK_AGENDA: AgendaEvent[] = [
  { name: "Deep work — Kestrel", where: "Blocked · no room", start: 8.5, end: 11, kind: "focus" },
  { name: "Standup", where: "Zoom · 6 people", start: 11, end: 11.25, kind: "meeting" },
  { name: "1:1 with Priya", where: "Corner room", start: 13, end: 13.75, kind: "meeting" },
  { name: "Kestrel launch review", where: "Zoom · 11 invited", start: 15, end: 16.25, kind: "meeting" },
  { name: "Pickup + dinner", where: "Family", start: 17.5, end: 19, kind: "personal" },
];

export const MOCK_REPLIES: Reply[] = [
  { from: "Priya Raman", subject: "Re: pricing model v4 — need your call on the enterprise tier", age: "18h", note: "Blocking her", urgency: 1 },
  { from: "Marcus Vogel", subject: "Offsite agenda — can you own the Thursday session?", age: "1d", note: "Answer yes/no", urgency: 2 },
  { from: "Dana Osei", subject: "Contract redlines attached", age: "2d", note: "Oldest waiting", urgency: 2 },
  { from: "Jo Nakamura", subject: "Two candidates for the platform role", age: "3d", note: "Can wait", urgency: 3 },
];

export const MOCK_ARC: ArcWindow = { from: 6, to: 22 };
