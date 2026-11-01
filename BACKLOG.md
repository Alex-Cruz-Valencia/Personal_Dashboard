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

### B-3. Plan the day
- **Problem:** the page shows what's on my plate but not whether it fits. Tasks and calendar sit side
  by side with nothing joining them.
- **Evidence:** 2026-10-31: 17 tasks due, 14 of them overdue, beside a calendar with its free time
  unused.
- **Idea:** show free hours against estimated task hours, and let a task be dragged onto the calendar
  to block time.
- **Why first:** highest impact for the least new work. `PlanCard`, `buildPlan()`,
  `/api/plan/suggest` and `freeSpans()` already exist; "Plan with AI" just has no UI.
- **Done when:** I can tell in five seconds whether today is realistic, and a block takes one drag.
- **Risk:** it could turn into a second calendar. Keep it to blocking time.
- **Impact / effort:** High / M

### B-4. Overdue reset
- **Problem:** "14 overdue" is a number I can't act on quickly, so it soon gets ignored.
- **Idea:** a one-at-a-time pass like Clarify: today, a new date, someday or delete.
- **Why here:** reuses most of `ClarifyPanel`, and clears the way for B-3, which is only honest once
  the task list is.
- **Done when:** a backlog of that size clears in under five minutes, and the overdue count stays low.
- **Impact / effort:** High / S

## Later

### B-5. Waiting on others
- **Problem:** the strip tracks replies I owe, not emails I sent that nobody answered.
- **Idea:** one more chip, from sent threads with no reply after a few days.
- **Open question:** telling a real "waiting" from a sent FYI. Probably needs an explicit mark.
- **Impact / effort:** Medium / M

### B-6. Meeting prep
- **Problem:** finding the context for the next meeting means searching mail and docs by hand.
- **Idea:** before a meeting, show recent emails with the guests, linked docs and related tasks.
- **Open question:** this sends more to the model, against the "send the minimum" rule. It may work
  with plain search and no AI.
- **Impact / effort:** Medium to high on busy days / L

### B-7. End-of-day shutdown
- **Problem:** "That's the day" says the day is over but doesn't close it out.
- **Idea:** a two-minute review of what got done, what moves to tomorrow and tomorrow's first block.
- **Why later:** depends on B-3, and it feeds the next morning.
- **Impact / effort:** Medium / M

### B-9. Better undo reach
- **Problem:** undo covers the latest action only, and edits made in an open editor aren't covered.
- **Why later:** wait to see whether that's ever missed in daily use.
- **Impact / effort:** Low / M

## Decided against for now

- **New data sources (Slack, health, finances).** More to look at, when the real problem is deciding
  what to do with what's already here. Revisit once B-3 and B-4 have shipped.

## Done

| ID | Item | PR | Date |
| --- | --- | --- | --- |
| B-8 | Suspected bugs checked: 7 fixed, 3 closed (below) | pending | 2026-11-01 |
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
