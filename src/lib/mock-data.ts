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
  place: "San Francisco, CA",
  tempNow: 61,
  condition: "Coastal fog, clearing by ten",
  sunrise: 6.4,
  sunset: 19.8,
  footnote: "No rain expected · Wind 7 mph NW",
  hourly: [
    { h: 6, t: 55, note: "Dense fog" },
    { h: 7, t: 56, note: "Dense fog" },
    { h: 8, t: 58, note: "Fog thinning" },
    { h: 9, t: 61, note: "Fog thinning" },
    { h: 10, t: 65, note: "Clearing" },
    { h: 11, t: 69, note: "Sunny" },
    { h: 12, t: 72, note: "Sunny · UV 7" },
    { h: 13, t: 74, note: "Warmest stretch · UV 8" },
    { h: 14, t: 74, note: "Warmest stretch · UV 8" },
    { h: 15, t: 73, note: "Sunny · breeze picking up" },
    { h: 16, t: 71, note: "Breezy, 14 mph" },
    { h: 17, t: 68, note: "Breezy, 14 mph" },
    { h: 18, t: 65, note: "Clear · good for a walk" },
    { h: 19, t: 62, note: "Sunset 7:48pm" },
    { h: 20, t: 59, note: "Cooling fast" },
    { h: 21, t: 57, note: "Fog returning" },
    { h: 22, t: 56, note: "Fog returning" },
  ],
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
  {
    name: "Deep work — Kestrel",
    where: "Blocked · no room",
    start: 8.5,
    end: 11,
    kind: "focus",
    description:
      "Hold for the launch draft. Phone on Do Not Disturb — Slack can wait.",
  },
  {
    name: "Standup",
    where: "Zoom · 6 people",
    start: 11,
    end: 11.25,
    kind: "meeting",
    meetingLink: "https://zoom.us/j/000000000",
    attendeeCount: 6,
    description: "Async-friendly. Post your update in the thread if you're heads-down.",
  },
  {
    name: "1:1 with Priya",
    where: "Corner room",
    start: 13,
    end: 13.75,
    kind: "meeting",
    location: "Corner room, 4th floor",
    attendeeCount: 2,
  },
  {
    name: "Kestrel launch review",
    where: "Zoom · 11 invited",
    start: 15,
    end: 16.25,
    kind: "meeting",
    meetingLink: "https://zoom.us/j/111111111",
    attendeeCount: 11,
    description:
      "Go / no-go on the Tuesday launch.\n\nAgenda:\n1. Open bugs (Dana)\n2. Pricing page copy (Priya)\n3. Comms plan (Marcus)\n4. Decision",
  },
  {
    name: "Pickup + dinner",
    where: "Family",
    start: 17.5,
    end: 19,
    kind: "personal",
  },
];

export const MOCK_REPLIES: Reply[] = [
  { from: "Priya Raman", subject: "Re: pricing model v4 — need your call on the enterprise tier", age: "18h", note: "Blocking her", urgency: 1 },
  { from: "Marcus Vogel", subject: "Offsite agenda — can you own the Thursday session?", age: "1d", note: "Answer yes/no", urgency: 2 },
  { from: "Dana Osei", subject: "Contract redlines attached", age: "2d", note: "Oldest waiting", urgency: 2 },
  { from: "Jo Nakamura", subject: "Two candidates for the platform role", age: "3d", note: "Can wait", urgency: 3 },
];

export const MOCK_ARC: ArcWindow = { from: 6, to: 22 };
