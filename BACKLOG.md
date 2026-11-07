# Backlog

What this product could do next, why, and in what order. `DESIGN_LOG.md` records decisions already
made; this file records the ones still open, so the reasoning behind each priority isn't lost.

**The product goal:** one page that tells me what needs me today and lets me deal with it there.
Its one user is me, so "evidence" below means something I saw in daily use, not a survey.

**How items are ranked:** impact on that goal against effort, reuse of what exists breaking ties.
Impact asks how often the problem comes up and what it costs when it does. Effort is relative: S is
an afternoon, M a few days, L a week or more.

**Status:** `Now` (being built), `Next` (ordered, not started), `Later` (worth doing, not yet),
`Done` (shipped, moved to the bottom with its PR), `Dropped` (decided against, with why).

## Now

Nothing in progress.

## Next

Nothing ordered. Pick from Later.

## Later

### B-6. Meeting prep
- **Problem:** finding the context for the next meeting means searching mail and docs by hand.
- **Idea:** before a meeting, show recent emails with the guests, linked docs and related tasks.
- **Open question:** this sends more to the model, against the "send the minimum" rule. It may work
  with plain search and no AI.
- **Impact / effort:** Medium to high on busy days / L

### B-10. Small gaps left from the bug hunt
- Clarify's event form can't end an event at midnight.
- The task menu inside forms doesn't manage keyboard focus when its view changes.
- Stray-click protection doesn't cover the task form in the reply queue.
- A saved reply draft can't be edited from the dashboard, only in Gmail.
- **Impact / effort:** Low / S

### B-11. Try the undo and Gmail link paths on real data
- **Problem:** undo for real Gmail and Calendar writes, and Gmail links with several accounts signed
  in, have only been tested with intercepted requests or unit tests.
- **Done when:** each has been used once on something unimportant.
- **Impact / effort:** High if broken / S

### B-9. Better undo reach
- **Problem:** undo covers the latest action only, and edits made in an open editor aren't covered.
- **Why later:** wait to see whether that's ever missed in daily use.
- **Impact / effort:** Low / M

### B-12. Plan the day: what's left
- **AI plan:** "Plan with AI" proposes blocks across free gaps. `/api/plan/suggest` still exists. Wait
  to see whether dragging feels like too much work.
- **Phone:** dragging needs a mouse. A "Block next free time" menu item would cover touch and keyboard.
- **Tomorrow:** plan onto tomorrow from the night review.
- **Impact / effort:** Medium / M

### B-13. Push notifications
- **Problem:** event alerts only work with a dashboard tab open.
- **Idea:** a service worker, saved device subscriptions and a scheduled server check. iPhone needs
  the dashboard on the Home Screen, and Vercel's schedule may be too coarse for a 10-minute alert.
- **Why later:** see first whether missed alerts actually happen.
- **Impact / effort:** Medium / L

### B-14. "Leave by" for tomorrow's first event
- **Problem:** Tomorrow at a glance says when the first event starts, not when to leave for it.
- **Idea:** travel time from a maps API for events with a place, shown on the "First" line.
- **Why later:** a new key and data source; see whether the start time is enough.
- **Impact / effort:** Medium / M

## Decided against for now

- **A "does today fit" capacity line (from B-3).** Knowing whether there's enough time rarely changes
  anything; the value is in placing tasks. Dropped before building.

- **New data sources (Slack, health, finances).** More to look at, when the real problem is deciding
  what to do with what's already here. Revisit once B-3 and B-4 have shipped.

## Done

| ID | Item | PR | Date |
| --- | --- | --- | --- |
| B-5 | Waiting on others | — | 2026-11-07 |
| — | Tomorrow at a glance in the evening card | #85 | 2026-11-06 |
| — | Event alerts, while a tab is open | #82 | 2026-11-01 |
| — | Sky themes | #82 | 2026-11-01 |
| B-3 | Plan the day: drag a task onto the calendar | #81 | 2026-11-01 |
| B-4, B-7 | Day review: Overdue reset and End-of-day shutdown as one feature | #80 | 2026-11-01 |
| B-8 | Suspected bugs checked: 7 fixed, 3 closed (below) | #79 | 2026-11-01 |
| B-1 | Undo after writes | #78 | 2026-11-01 |
| B-2 | Finish the bug hunt, add a test suite | #78 | 2026-11-01 |
| — | Needs attention as one line of counts | #77 | 2026-11-01 |
| — | Top three bug hunt fixes | #76 | 2026-11-01 |

### What B-8 found

Correctness work: each suspicion was tested on real data before anything changed.

| Suspicion | Result | Evidence |
| --- | --- | --- |
| DNS rebinding past the write guard | Fixed | A forged host got through the guard (400, not 403). Now 403 on every route |
| Clarify draft addressed to yourself | Fixed | No live case today, but the logic allows it. Now continues to the original recipient |
| Non-ASCII names in a draft's `To:` | Fixed | Sent unencoded. Now encodes the name only; unit tested, no real draft saved |
| Gmail links fixed to `/u/0` | Fixed | Now name the connected account. Not tried with several accounts signed in |
| HTML email loses links and entities | Fixed | Unit tested |
| Parallel token refreshes | Fixed | From reading the code. One shared refresh, and an atomic file write |
| `GET /api/summary` unguarded | Fixed | No UI uses it. Other sites now get 403 |
| Failed Gmail reads dropped quietly | Not reproduced | 240 parallel reads, 0 failures. Now logs a count if it happens |
| Label total counts trashed threads | Closed | Total and list matched, 14 and 14. Worst case is an empty Clarify |
| Duration on a date-only task errors | Closed | Real test task accepted it (200) |
