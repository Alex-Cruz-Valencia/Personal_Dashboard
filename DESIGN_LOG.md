# Design Log

A running record of the product/design decisions behind this dashboard —
UI, UX, and user-flow choices, not just visual ones — not the code changes
themselves (git history already has those), but the *why*: the problem
noticed, the options weighed, and the reasoning behind what shipped. Kept
for retrospectives, write-ups, and interview prep.

Newest first. Each entry:

```
## YYYY-MM-DD — Short title

**Problem / trigger** — what prompted this
**Decision** — what we did
**Reasoning** — why this over the alternatives
**Alternatives considered** — what else was on the table, and why not (if any)
**Tradeoffs / open questions** — what this costs, or what's still unresolved
```

---

## 2026-10-27 — From a display to a decision tool (the one-page story)

*Read this first. It's the narrative for retros, a PM log and interviews; the
entries below it hold the detail for each decision.*

**Starting point** — A pretty, read-only morning dashboard: weather, tasks,
calendar and mail in eight equal cards. Good to look at, but it showed
information instead of helping decide anything.

**The user insight that reframed it** — Asked "what question should this answer
in five seconds?", the answer was "**what did I miss?**", and the screen stays
open all day on a second monitor. That made it an *ambient decision tool*, not a
morning summary, and it shifted the priority from aesthetics to function ("I
don't so much care about the aesthetics as the function").

**What we built, in the order of value**
1. *Attention strip* — conflicts, tight turnarounds, overdue tasks and replies
   in one row, each one click from action; a calm "Nothing missed" when clear.
2. *Act where you see it* — a reply item opens the emails with Reply, Wait a
   day, Move and Trash, instead of scrolling to a list.
3. *Day arc that reads time* — free gaps labelled, overlaps marked, a Now/Next
   readout.
4. *Look ahead* — a week strip of booked time and tasks due, "Heavy" in words.
5. *Protect time* — a local focus timer (arc block, tab title).
6. *AI that drafts and proposes, never acts* — reply drafts saved as Gmail
   drafts; a suggested schedule where each block needs its own click.

**Update 2026-10-28** — After living with it, the lower area was simplified: the
horizontal day arc and the Plan/Replies columns were replaced by a vertical,
Google-Calendar-style day view beside today's tasks (the week strip moved below
them so action starts higher). Replies stay reachable through the attention strip.
Scope was misread once ("leave only these two" meant the bottom blocks, not the
whole page), a reminder to restate which regions change before building.

**Decisions worth explaining in an interview**
- *Iterating the look in public.* Four passes: restraint (flat, warm) → an
  editorial experiment (huge headline) → pulled back ("reads like a landing
  page; this is a productivity tool") → pulled back again ("too bare, hard to
  look at") → calm cards. Lessons: a tool's first screen belongs to action, so
  nothing decorative may push content below the fold; and removing containers
  made scanning harder, not easier.
- *Aggregate, don't flood.* Overdue tasks are one strip line, not one per task
  (a backlog would bury everything else). Applied the metric-overload lesson from
  dashboard-design research: few items, each tied to a decision.
- *Human in the loop for every write.* AI never sends mail or books time; drafts
  go to Gmail Drafts, schedule suggestions need a Block click. Wait/snooze and the
  timer are local-only so nothing outside the dashboard changes silently.
- *Don't trust the model's output.* A server-side validator drops any suggestion
  that names an unknown task, overlaps, starts in the past, or doesn't fit a gap,
  and forces the task's own length. Email text is marked untrusted in the prompt.
- *Data minimization and key safety.* The key lives only in gitignored
  `.env.local` and server code; routes fail closed when AI isn't configured (so
  the public demo can't spend tokens), accept same-origin only, cap input/output
  and rate. Scheduling sends task names and gaps only (no mail, no event titles);
  drafting sends one email. Model choice is a privacy decision (school-hosted vs
  cloud), left to the owner.
- *Reuse over new permissions.* Gmail drafts work with the existing
  `gmail.modify` scope, so no re-consent. (An earlier answer to the user claimed
  otherwise; it was corrected once checked.)

**Bugs the real model exposed (and why test against the real thing)** — It
rejected a custom `temperature` (every AI call would have failed), and its token
budget includes hidden reasoning, so answers were truncated mid-JSON (empty
suggestions). Fixes: drop the parameter, raise budgets, and salvage complete
items from a cut-off reply. Mocked tests had passed both times.

**How I'd measure it (proposed; no data yet)** — Time from opening the page to
the first action; items cleared from the strip per day; share of drafts saved
unchanged vs edited vs discarded; share of suggested blocks accepted vs
dismissed; how often "Nothing missed" shows (is the strip too noisy or right?).

**Open questions / next** — Click a week day to load it in the arc; server-side
snoozes and timer so a second screen shares them; make the "heavy day" threshold
and the 30-minute task default settings; evaluate draft quality across models.

## 2026-10-29 — A warm light theme

**Problem / trigger** — Trying "By time" put the light theme in front of Alex
every morning, and it read harsh: a near-white page, near-black text, and on
overcast days a cool grey-blue sky behind everything with grey calendar blocks.
Not the warm, calm morning the experiment was for.

**Decision** — Warm the light theme itself: cream canvas `#F3E6D3`, parchment
cards `#FCF6EC`, espresso ink `#2B2118` with warm browns for secondary text.
In light mode the page sky uses sunrise tones (apricot/peach) instead of
grey-blue for clear, overcast and rainy weather, the drifting clouds are a warm
sand instead of grey ink, and "personal" calendar blocks sit on the warm
surface with a slate edge instead of a slate fill. Teal accent unchanged. Dark
is untouched.

**Reasoning** — One light palette, not a separate "morning" one: anyone on
Light or on System in daylight gets the same warmth, and there's no third token
set to keep in sync. The text tokens were picked by contrast first (ink 14.6:1,
ink-soft 6.2:1, ink-faint ≥4.5:1 on the card surfaces), so warmer doesn't mean
harder to read.

**Alternatives considered** — *A morning-only palette for "By time"*: more
distinctive, but two light themes to maintain and the plain Light option would
stay harsh. *Recolor "personal" events to a warm hue*: the blue / amber / slate
triad is chosen to stay apart for colorblind viewers; a warm clay sits too
close to both amber and the red "negative" color, so the slate edge stays.

**Follow-up (same day): no blue in light.** On the cream, every blue still
jumped out — the teal accent (date, Now, curve dot, week bars), the "someday"
priority, the slate-blue "Waiting" label and meeting blocks. In light only:
accent → moss `#4E6A2C`, someday priority → plum `#7A4E6E`, meetings → muted
plum `#7A5A70`, neutral → warm grey `#665A4E`; all ≥4.8:1 on the warm surfaces.
Dark keeps teal and its blues — they sit well on near-black. The calendar's
colorblind spread holds: plum (meetings), moss (focus) and warm grey (personal)
still differ in both hue and lightness. Teal stops being "the" brand color;
each theme now has its own accent.

**Tradeoffs / open questions** — Supersedes the 2026-10-27 canvas `#F4F1EA`.
The weather card's own little scene and the glass surface layer weren't retuned;
if Glass is turned on in the morning it may want the same pass.

---

## 2026-10-29 — Experiment: the theme follows the day ("By time")

**Problem / trigger** — The dashboard is opened first thing in the morning and
again through the afternoon and evening. One fixed theme fits neither end well:
the dark theme feels heavy at 8am in daylight, the light one glares at night.
Alex wanted to try a light, airy page in the morning that hands over to the
current dark theme once the afternoon starts.

**Decision** — A fourth Appearance option, **By time** (`theme: "timed"`):
light from 5am until a "Dark from" hour (default **noon**, editable in ⚙ right
under the option), dark from then until 5am. The server resolves it per render
from the viewer's local hour (`shownTheme()` in `settings.ts`), so every card,
popover and the page background flip together, and the existing one-minute
auto-refresh carries the switch over without a reload. Opt-in; System stays
the default.

**Reasoning** — Resolving on the server reuses the whole light/dark token
system as it is — no third palette to keep in sync, no client clock that could
disagree with the server's "now". The hour is the user's to set because
"afternoon" is personal (noon for some, 3pm for others). `?now=9` / `?now=14`
previews either side.

**Alternatives considered** — *Switch at sunset* (data is already there): but
the ask was specifically "afternoon", and sunset swings by ~3 hours across the
year. *A gradual blend of the two palettes through the day*: prettier, but every
token pair would need an in-between that still passes contrast — far more work
for an experiment. *A brighter, separate "morning" palette*: possible next step
if the existing light theme doesn't feel light enough.

**Tradeoffs / open questions** — The flip is a hard cut at the minute
boundary, not a fade. Before 5am it's dark, which assumes nobody wants a light
page in the small hours. Worth living with for a few days before deciding
whether it becomes the default.

---

## 2026-10-29 — Bug hunt: edits that vanished, writes any site could trigger, and a DST blind spot

**Problem / trigger** — A deliberate sweep of the whole app for things that
would bite in real use rather than in a demo. The ones that changed behavior
(pure fixes are in git):
- Typing a note or a new name in the task/event editor and then pressing Esc
  or clicking outside **silently threw the edit away**: fields save on blur,
  and closing removed the card before focus ever left the field. Confirmed by
  turning the fix off and watching no save go out.
- Every write route (add task, delete event, trash mail…) answered **any
  website open in the same browser**. On `localhost:3000` nothing sits in
  front of the app, so a page could post a form at it. Only the AI routes
  checked the origin.
- Changing an event's time in the editor sent a reschedule **per keystroke**
  ("1", then "10" for 10:00) — racing PATCHes that could land out of order.
- Deleting or completing from an editor **closed the card before the server
  answered**, so a refusal (a read-only shared calendar) looked like success.
- An event that started yesterday or runs past midnight is drawn clipped to
  00:00/24:00; dragging it, or touching its times, would have **saved the
  clipped times** and cut the real event short.
- The settings panel saved the *resolved* settings, so visiting `/?theme=dark`
  once and then changing density **froze "dark" into your saved prefs**; and a
  "Day starts" after "Day ends" was saved and broke the calendar outright.
- The settings card (and any popover taller than 400px) was placed too low and
  **ran off the bottom of a short window**, with no way to reach its last
  fields.
- On a DST change day (this Sunday, Nov 1) the calendar's day window started at
  1am, so a **midnight–1am event would have been missing**.
- The never-send guard missed Gmail's upload-form send path and batch requests.

**Decision** —
- Closing a popover (outside click, Esc, ×) blurs the focused field first, so
  an edit in progress is saved, never dropped.
- One shared check (`rejectCrossSite`, `src/lib/request-guard.ts`) on every
  write route: requests from another site get a 403. The disconnect link still
  works when typed into the address bar, but not from a link elsewhere.
- Reschedules wait until the date/time fields settle (~0.7s), then send once;
  a pending one is still sent if the card closes.
- Destructive actions (delete, complete) close the card only after the server
  agrees; otherwise the error shows in place.
- Clipped events can be opened and renamed but not dragged or re-timed, with a
  line saying to change their times in Google Calendar.
- The settings panel merges each change into what's already stored; the hour
  fields bound each other, and a bad stored day window falls back to defaults.

**Reasoning** — Every one of these is a case where the app said one thing and
did another: it looked saved and wasn't, looked deleted and wasn't, or looked
like *your* dashboard while answering anyone. For a tool that writes to your
real calendar, tasks and inbox, quiet failure is worse than a visible error.
Saving on close (rather than asking "discard changes?") matches how the editors
already behave — every field auto-saves — so close is just one more way of
leaving a field.

**Alternatives considered** — A "Save" button on the editors (more explicit,
but contradicts the auto-save pattern every other field follows); blocking
cross-site requests with a CSRF token (stronger in theory, but the same-origin
check already covers browsers and needs no state); making clipped events fully
editable by fetching their real start/end (more code for a rare case — Google
Calendar is one click away via "Open in Calendar").

**Tradeoffs / open questions** — A script with no browser headers (curl) still
passes the origin check by design; on the private deployment, Vercel's
protection is what gates that. The Anthropic day note (when that key is set)
is still regenerated on every 60-second refresh — fine on cost today because
the key isn't set, but it should be cached before it is.

---

## 2026-10-28 — Ambient motion: a weather scene and a live clock

**Problem** — The dashboard is meant to sit on a second screen all day, but
it was static: nothing said "this is live" at a glance, there was no clear
time anywhere (only a "Refreshed 10:05pm" footnote), and the weather card was
a number and a line. A screen you glance at needs something that moves a
little and tells you the time without reading.

**Decision** — Two additions, both quiet. (1) A **weather scene** behind the
weather card: rain falls, wind streaks glide, a sun breathes with slow rays
(moon and twinkling stars at night), snow drifts, fog banks slide, storms get
a faint flash. Wind adds streaks on top of any sky at 15+ mph. Driven by a new
`Weather.sky` (kind + wind) mapped from the WMO code Open-Meteo already
returns. (2) A **clock card** beside the weather: big time with a pulsing
colon and live seconds, a day rail (now vs. your day window) with a pip that
moves, "X left in your day", and "Now / Next: <event> in 25m".

**Reasoning** — The scene is pure CSS (no canvas, no JS loop), so it costs
nothing after render and the browser throttles it when the tab is hidden.
Particle positions come from index math, not `Math.random()`, so server and
client markup match. The clock reads the dashboard's own timezone (not the
browser's) so it can't disagree with the agenda, and it hydrates from the
server's time first, then takes over. Everything stops under
`prefers-reduced-motion` and under ⚙ Motion → Still, because an always-on
screen must be easy to quiet.

**Alternatives considered** — A canvas particle system (prettier, but a
constant JS cost on a screen that stays open all day); a full-page weather
backdrop (bigger effect, but it would sit behind every card and hurt
legibility); putting the time inside the greeting card (no room, and it hides
the one thing the second screen is for).

**Tradeoffs / open questions** — Motion is decorative, so it is kept low in
opacity: legibility wins over spectacle. `?sky=rain&wind=20` previews any
scene without waiting for weather (only the animation changes). Day/night uses
sunrise and sunset, so the sun only shows while it is actually up. In demo
mode the clock is frozen at the sample time so it stays consistent with the
sample agenda. Unverified: how it feels after hours on a real second screen.

## 2026-10-28 — Greeting and clock merged into one card

**Problem** — The clock card sat beside the greeting, so the top row was three
boxes (greeting, clock, weather) and the greeting card ended up with a lot of
empty space next to a small clock card.

**Decision** — One card: greeting, date and day note on the left, the live
clock (time, day rail, Now/Next) on the right behind a thin divider. Weather
stays its own card, since it carries the scene. Below 1040px the weather drops
under it; on a phone the clock stacks under the greeting.

**Reasoning** — Same content, one fewer box: "what's today" and "what time is
it" are the same glance. Nothing was removed.

**Alternatives considered** — Moving the clock into the weather card (crowds
the temperature curve and the scene); keeping three cards (the status quo).

**Tradeoffs / open questions** — The greeting card is a little denser. The
clock is still a separate component slotted into the greeting card, so it can
be moved again cheaply.

## 2026-10-28 — Greeting card: drop "Shape of the day", add a sun line; the time breathes

**Problem** — The day note ("8h 5m before X — focus on Y") restated what the
calendar header and now-line already say, and the seconds sweep line under the
time was decoration the user liked less than the earlier breathing motion.

**Decision** — (1) Remove the "Shape of the day" note from the card. (2) Add
one quiet line under the greeting that the calendar *doesn't* say: where the
sun is. By day, "2h 10m of daylight left · sunset 7:48pm"; at night, "Sun is
down · sunrise 6:24am", with a small breathing warm or cool dot. (3) Replace
the sweep line with a slow breathing of the time itself (opacity and a soft
accent glow over 6s), keeping the pulsing colon.

**Reasoning** — One home per fact, again: schedule belongs to the calendar,
the time to the clock, and what's left over for the greeting card is the sky.
It ties the card to the weather scene and the sky tint without repeating
either.

**Alternatives considered** — Task counts ("3 due today") — also on the task
card; week number or day-of-year (trivia); a daily quote (noise); moon phase
(nice, small, a candidate for later).

**Tradeoffs / open questions** — The card is emptier and shorter. The day
note's AI call still runs on the server and `/api/summary` still serves it; it
is just not shown, so that token spend could be removed too. ⚙ "Day note"
voice now does nothing visible.

## 2026-10-28 — Greeting card: date back to the top left

**Decision** — The date label returns to the top left, above the greeting, as
in the reference; the light graded time stays on the right with its minute
sweep. On a phone the order is date, greeting, note, then the time.

**Reasoning** — The user wanted the reference's reading order back on the left
while keeping the time where it was. The right side is now just the time.

**Tradeoffs / open questions** — On a phone the time lands at the bottom of
the card, which is less glanceable than at the top; revisit if the phone view
matters.

## 2026-10-28 — Greeting card, fourth composition: light, graded time on the right

**Problem** — The pill (third composition) was tidy but small and boxed; the
112px version (second) was too loud. The user asked for something in between,
in a different style.

**Decision** — Greeting and day note on the left. On the right, a stacked
block: the date label above a 48–60px time in a lighter weight, with the
digits fading softly from full ink to about half at the bottom, and the
minute-sweep hairline beneath. No box, no divider. On a phone the date and
time move to the top and the greeting follows.

**Reasoning** — Slightly bigger than the pill, but quieter than the hero
version: lighter weight and a gradient make it feel like part of the card's
type rather than a widget. The date belongs with the time, so it moves over.

**Alternatives considered** — The three earlier compositions (each one commit
back, to compare or revert).

**Tradeoffs / open questions** — The gradient lowers contrast a little at the
bottom of the digits. Fixed one bug on the way: the blinking colon was an
inline-block, which the gradient text clip does not paint through, so it
vanished; it is plain inline now.

## 2026-10-28 — Greeting card, third composition: time as a compact badge

**Problem** — The second composition made the time 112px, which overpowered
the greeting and turned a welcome into an instrument panel.

**Decision** — The greeting leads again at its original size. The time becomes
a small pill on the date line, top right (36px digits, tiny seconds and am/pm,
the minute-sweep hairline along the pill's bottom edge). Day note beneath, as
in the reference. On a phone the pill stays beside the date.

**Reasoning** — Glanceable without dominating: the time is still the one
element that moves, but the card keeps its human tone. Putting it on the date
line pairs the two time facts (date, clock).

**Alternatives considered** — The two earlier compositions (one and two
commits back, to compare or revert); time inline after the greeting.

**Tradeoffs / open questions** — Smaller digits are harder to read from across
a room than the 112px version. If that matters on the second screen, nudge the
badge up a size rather than reverting.

## 2026-10-28 — Greeting card, second composition: time on the left

**Problem** — The first composition (greeting left, time right, note below)
worked but still felt like a header row plus a footer strip.

**Decision** — Swap and scale: the time is the hero on the left, up to 112px,
with the date above it and the seconds hairline below. The greeting and day
note sit to its right, vertically centred. Whitespace separates them; no
divider. On a phone it stacks: date, time, greeting, note.

**Reasoning** — Reading order follows importance on a second screen: what
time is it, then a human sentence about the day. One block of type per side
makes the card feel composed rather than assembled.

**Alternatives considered** — The previous composition (greeting-first, kept
one commit back to compare or revert); time centred above both.

**Tradeoffs / open questions** — The greeting is no longer the biggest thing
in the card, which changes the tone from welcoming to instrumental. If that
feels cold, revert to the previous commit.

## 2026-10-28 — Greeting card composition: time as the hero

**Problem** — With the clock reduced to the time, the merged card still read
as two things side by side: a left block and a small clock behind a divider.

**Decision** — One composition. Top line: date and greeting on the left, a
large time on the right, bottom-aligned so they share a baseline. Under the
time, a hairline that fills across each minute (a seconds sweep). The day note
sits beneath, full width. No divider, no "Right now" label. On a phone the
time stacks under the greeting.

**Reasoning** — The time is the one number you read from across a room, so it
gets the scale; the greeting and note read up close. The sweep line is the
only decoration and doubles as proof the clock is live.

**Alternatives considered** — Time centered above the greeting (pushes the
greeting down); a circular seconds ring around the digits (busier, harder to
fit beside the greeting).

**Tradeoffs / open questions** — The card is a bit taller. Judged by eye at
three widths, not on a real second screen yet.

## 2026-10-28 — Clock shows only the time

**Problem** — Under the time, the clock repeated things the calendar already
says (the next meeting), asserted something not quite true ("your day starts
at 6am" is just a display window, not the user's schedule), and drew a day
progress bar that duplicated the calendar's now-line.

**Decision** — The clock is just the time: big digits, live seconds, am/pm,
a softly pulsing colon. "Where am I in the day" and "what's next" belong to
the calendar, which already has the now-line, the Now/Next status and the
current-event progress.

**Reasoning** — One home per fact. A glance at the top should answer "what
time is it" and nothing else; repeating the calendar elsewhere adds noise and,
in the "day starts" case, a claim we can't back up.

**Alternatives considered** — Keeping the rail but dropping the text (still
duplicates the now-line); keeping Next (duplicates the calendar header).

**Tradeoffs / open questions** — The right side of the card is sparser; the
time is a little larger to hold it.

## 2026-10-28 — Ambient motion, round two: calendar states, refresh pulse, sky tint

**Problem** — After the weather scene, the rest of the screen was still
static. The calendar showed *where* events were but not where you are in
them; nothing proved the page was still refreshing; and the weather's mood
stopped at its own card.

**Decision** — Three small, informative motions. (1) **Calendar:** the
now-line glides on its own between server refreshes; past events fade, the
current one breathes with a thin progress bar, and one starting within 15
minutes pulses slowly. (2) **Refresh pulse:** the footer's "Refreshed" stamp
flashes once each time the 60s auto-refresh lands. (3) **Sky tint:** a slow
colour wash behind the glass cards that follows the sun (night blue, dawn
rose, day sky, dusk amber), eased between sunrise and sunset.

**Reasoning** — Each one answers a glance-question: "where am I in the day",
"is this live", "what time of day is it". The tint only exists with glass
surfaces (solid cards would hide it) and ⚙ Motion on. "Now" is shared through
one `useNowSeconds` hook (dashboard timezone, quantised: 15s for the
calendar, 60s for the tint) so nothing re-renders every second but the clock.

**Alternatives considered** — Pulsing the attention strip's urgent items
(skipped: an alert you can't dismiss nags on an always-on screen); a canvas
sky (constant JS cost); a progress ring per event (too busy).

**Tradeoffs / open questions** — Fading past events trades a little legibility
of history for focus on what's ahead. The tint is deliberately faint,
especially in dark mode. Only checked at night (everything past): the
now/soon states and day/dusk colours were verified by forcing classes, not
by waiting for them.
## 2026-10-28 — Email to task, and an expanded week

**Problem** — "What did I miss?" ends in a dead end: an email that needs doing
(not replying) either sits on the pending list forever or gets re-typed into
Todoist by hand. And the week strip says how *busy* each day is but not *with
what*, so planning ahead still meant opening Google Calendar. (Draft reply, the
first thing asked for, already existed: it saves to Gmail drafts and never sends.)

**Decision 1: "Make task" on each email.** A panel with three editable fields
(title, priority, due date) and an optional "Fill in from the email" button where
the AI reads the message and proposes them. Nothing is written until "Add to
Todoist". The task is created with Todoist's structured fields (priority, due
date, a description linking back to the email), not its typing shortcuts like
`p1` or `tomorrow`, so what you see in the fields is exactly what is saved.
"Take this email off my list" is on by default and hides it for 30 days in this
browser only.

**Decision 2: expanded week.** The week strip gets an Expand button. Open, it
becomes a calendar-style grid: each day's tasks in a row, all-day events as
banners, then timed events as blocks on an hour grid (overlaps side by side). The
compact strip stays the default; the same data feeds both, with no extra requests.

**Reasoning** — The AI is a convenience, not a dependency: without it the panel
still prefills a sensible title ("Reply to Dana: Q3 budget") and works. Spending
tokens only on a click matches Draft reply. Because email text is untrusted, the
model's reply is reduced server-side to three checked fields (title cut to 140
characters, priority forced to 1 to 3, due date accepted only if it is a real
date between today and a year out); instructions inside an email can't do
anything else. Taking the email off the list is local (the email in Gmail is
untouched), consistent with Wait a day.

**Alternatives** — Letting the AI add the task directly (rejected: a wrong
guess lands in the real task list); using Todoist's natural-language string
(rejected: shortcuts misparse, e.g. a task about "p1 results"); archiving or
labelling the email in Gmail when a task is made (rejected: a write to a
different system the user didn't ask for); clickable events in the week grid
(skipped for now: the day view already has the full detail popover).

**Tradeoffs / still unproven** — "Off my list" is per browser, so a second
device still shows the email until it is moved or trashed. Verified a real task
write (priority, due date, description) and deleted the test task; the AI fill was
not exercised on real mail because the configured model had been withdrawn by the
provider (see the model note in the PR).

## 2026-10-28 — Click a day: its agenda and tasks, in a small panel

**Problem** — The week strip shows how busy each day is, and the expanded grid
shows all seven days at once, but there was no way to look at *one* day: its
agenda beside its tasks, without the noise of the other six.

**Decision** — Each day tile in the compact strip is a button. Clicking one
highlights it and opens a panel under the strip: the day's agenda on the left
as a vertical time grid like Google Calendar's day view — hours down the side,
blocks sized by duration, overlaps side by side, all-day banners on top — and its tasks on the right
(priority dot, name, due time), with a one-line summary ("6h booked · 5 events
· 0 tasks"). Click again, or Close, to put it away. Informational, like the
rest of the week; empty and not-connected states say so.

**Reasoning** — "What does Thursday look like?" is the real question the
strip raises. The panel answers it in place, from data the week already
fetched (no new requests), and leaves the compact strip as the default.

**Alternatives considered** — A plain agenda list for the left column (the
first version; the user asked for a calendar view, which matches the main
calendar and reads gaps better); opening the event popover per row (the week's
events don't carry details, and it would need another fetch); making the
expanded grid's column headers clickable (the grid already shows every day);
a side drawer (heavier for a glance).

**Tradeoffs / open questions** — Events and tasks inside the panel are not
clickable yet. Built on a combined experiment branch: the ambient work, plus
the email-to-task + expanded-week branch it depends on for the data.

## 2026-10-28 — Needs attention now matches the glass cards

**Problem** — With glass surfaces on, the Needs attention strip looked flat
and darker than every other card.

**Decision** — It is not built from the shared `.card` class (it has its own
`.attn`), and the glass layer only styled `.card`, so it kept the opaque solid
look. The glass rules (and the reduced-transparency fallback) now cover
`.attn` too.

**Reasoning** — A new surface type had been added without being added to the
list of things the material applies to; the fix is to name it there, not to
restyle the strip.

## 2026-10-28 — Hard guardrail: the app never sends email

**Problem** — AI can draft replies, so there must be no way for the app to
send one. The rule ("drafts only") was true of the code but nothing enforced
it, and Google's `gmail.modify` scope (needed for Trash and Move) technically
allows sending, so the OAuth scope can't be the guarantee.

**Decision** — Two code-level locks. (1) Runtime: every Google call goes
through `googleFetch`, which now refuses any Gmail send endpoint
(`messages/send`, `drafts/send`) before the request leaves. (2) Build time:
`scripts/check-no-send.mjs` scans the source for send endpoints and
send-capable scopes, and runs before every `next build` and with `npm run
lint`, so a deploy fails if such code is ever added.

**Reasoning** — The person said they never want mail sent from here, only
drafted. A promise in a comment isn't a guardrail; a thrown error and a failed
build are. Two layers because one catches a future bug at runtime and the other
catches the change before it ships.

**Alternatives considered** — Dropping to a narrower scope (no scope allows
Trash/Move but not send, and `gmail.compose` is itself send-capable); relying
on code review (no review on a solo project); UI-only protection (hides the
button, not the capability).

**Tradeoffs / open questions** — The guard is only as strong as "all Google
calls use `googleFetch`" (already a project rule). Someone could still edit the
guard away; it is a seatbelt, not a lock against the owner.

## 2026-10-30 — The top row becomes one card (Classic stays as a setting)

**Problem** — The top row is lopsided. The greeting card is wide and nearly
empty (a date, a greeting, a clock), while the weather card on the right carries
a place, a big temperature, a condition, a chart and a footnote. At 1280px that
is 854px of mostly air next to 350px of dense content, and the row is 251px tall.

**Options built** (tried behind a ⚙ switch, or `?top=`):
- **One card** (`unified`): greeting and clock across the top, the weather as one
  line under the greeting ("54° Partly cloudy · San Francisco · No rain expected
  · Wind 6 mph"), the day's temperature as a slim band across the full width, and
  a single scene behind it all with the sun or moon. 227px tall at 1280px.
- **Three tiles** (`trio`): greeting, clock and a slim weather tile (temperature,
  condition, place, a sparkline) as three even tiles. 140px tall at 1280px. The
  weather footnote is dropped in this one.
- **Classic**: the layout it started as, unchanged (now a choice, not the default).

**Why these** — Each moves weight to the left and shrinks the right. One card
keeps everything in one place and gives the scene a stage; three tiles is the
calmest and shortest, at the cost of three separate boxes.

**How it was built** — The temperature chart became its own component in three
sizes (full, a wide band; a sparkline for the tiles was dropped with them), and the
weather card now uses it too, so scrubbing works the same everywhere. On a phone the one-card version swaps the
band for the normal chart, and the tiles stack.

**Round two (One card chosen)** — Two notes: the temperature chart wasn't
pretty, and the card felt squished at the top. Chart: a smooth curve (monotone
cubic, so it never overshoots) with a soft accent-tinted fill, the hours already
gone drawn dimmer than the hours ahead, a dashed line and a gently pulsing ring on
"now", and just "68°" and "48°" beside the high and the low (the time moved into
the hover readout), flipped away from the "now" dot when they'd collide. The
labels moved off the top of the plot so the curve uses the full band height. Card:
30px above the date and 34px at the sides (was 20 and 26), more space between the
rows, the moon and the sun moved clear of the clock. Roughly 277px tall at 1280px
(classic 251px): taller on purpose. Added a preview-only `?now=14.5` to see the
page at another hour, which is how daylight was finally checked.

**Decision** — One card wins and is now the default top row. Classic stays as a
choice under ⚙ **Top row (One card / Classic)**; Three tiles was dropped (its code,
styles and the switch value are gone; a saved "trio" preference just falls back
to One card). `?top=classic` and `?top=unified` still work for a quick look. The
`?now=14.5` preview (which hour the page pretends it is) stays too, for checking
how the scenes look at other times of day.


## 2026-10-30 — Two layers of scenery: the page behind, the weather card in front

**Problem** — Moving the weather scene to the whole page backdrop (the Scene
background) took it out of the weather card. The card is where the moon, the
stars, the sun and the rain used to sit front and centre, and with the card
frosted over the page they just read as more background.

**Decision** — Two layers, with a clear rule. The page keeps its large,
ever-moving background (stars, meteors, sunbeams, rain, clouds) that changes
with the weather and the time of day. The weather card gets its own scene back,
up front: moon and stars at night, sun by day, rain and clouds in bad weather.
For now it is the only card with one. In Scene mode the weather card is nearly
opaque (93%, the other cards stay at 60%) so its scene is its own and doesn't
double up with the page's behind it. Background: Plain is unchanged (only the
card scene, solid cards); Motion: Still hides both; Glass surfaces keep the card
translucent.

**Alternatives considered** — Letting the page scene show through the weather
card as before (it read as background, not as the card's picture); a bigger
moon and sun in the card (the earlier size is what was liked); adding a scene
to every card (busy; the point is that the weather card is the one hero).

**Follow-up** — The first version drew the moon (and, by day, the sun) in both
places, so there were two moons. Rule now: the sun and the moon belong to the
weather card alone; the page background never draws them. The page keeps the
things that are atmosphere rather than a subject (stars, meteors, sunbeams,
rain, snow, clouds, fog). Checked across weather and time of day: the moon
appears only in the card on clear nights, the sun only in the card on clear days.

**Second card** — The greeting card now gets a scene of its own as well, the
same idea: stars on a clear night, clouds, rain, snow and wind in bad weather,
a faint warm glow by day, and never the sun or moon (those stay the weather
card's). Like the weather card it is nearly opaque in Scene mode so its picture
is its own. Both cards read from one component with a "celestial" switch.
Matrix checked for clear/cloudy/rain/snow by day and night on all three layers.

**Tradeoffs** — Stars still appear twice on a clear night (a few in the page
margins, a few inside the card), by design. The weather card is the one card you
can't see the sky through. Morning and evening still use the same
day or night scene; a dedicated dawn and dusk look is a possible next step.

## 2026-10-29 — "That's the day" waits for the evening; meteors by night, sunbeams by day

**Problem** — Two things. The goodnight scene appeared the moment the last
meeting ended, which in mid-afternoon is premature and made the calendar feel
like it had given up on the day. And the page-wide background, though pretty,
was static apart from twinkling stars; the wish was a little life that comes
and goes without demanding attention.

**Decision** — (1) The scene, its "That's the day." text and the hours sliding
away now only happen from the wind-down hour: ⚙ **Wind down at**, 9pm by
default, the same hour that already turns the day note to "wind down" and stops
Plan suggestions. Before it the calendar is just hours and events (with blank
scroll room, no scene). Setting it to midnight turns the scene off. No new
setting: one "when does my day end" knob. (2) On a clear night, five faint
shooting stars cross the page, each on its own 21–47 second cycle and visible
for a second or two, so on average one every ~6 seconds with no pattern. On a
clear day, two slow bands of golden light drift across the page, each on a
61 or 83 second cycle and visible for roughly a quarter of it, so there are
often none and sometimes one or two. The shooting stars are kept out of the sections: every card is cut
out of the meteor layer, so a meteor vanishes as it passes behind one and is
only seen in the margins and the gaps between cards. They fall diagonally; some
start in a margin and fly in behind the cards, others start behind the cards and
come out into a margin, so each is seen on its way in or out. Both are part of the page-wide scene only
(⚙ Background: Scene; Motion: Still hides them) and are invisible, not just
paused, under reduced motion.

**Alternatives considered** — Tying the scene to clock time only (wrong when an
evening event is still ahead, so it still needs "nothing left" as well); a
separate "scene starts at" setting (two settings for one idea); denser meteor
showers or rays on a fixed beat (busy, and the point is that it's not always
there); animated sun rays in the weather card too (the page is where the
ambience lives).

**Tradeoffs** — Before wind-down there is no "Plan tomorrow" button, since it
lives in the scene; it appears with the scene. With the scene off, an
evening calendar has a plain dark tail instead of the little hills. How much of a
meteor you see depends on the window: with wide margins about half of each
streak (checked at 1600px wide), in a narrow window about a fifth, because the
cards nearly fill it; no part of one is ever visible inside a card. A louder
version (seven meteors with glowing heads, a third beam) was tried and rolled
back as too much. I checked the animation frames by stepping them
to mid-flight, not by watching them play.

## 2026-10-29 — When the day is done, "That's the day" covers the whole calendar

**Problem** — With a day window ending at midnight, the calendar still showed
the last empty hours (11pm, 12am) as a plain grid above the scene, so the scene
looked like a card tacked onto the bottom instead of the calendar's whole
state. It only filled everything in a window that happened to end at 10pm.

**Decision** — When nothing is left today (every event is over, or the day has
no events and the window has run out) the remaining hours slide away and the
scene fills the entire calendar under the header. The "↑ Earlier today"
pill and scrolling up still bring the day back, and "Now" returns to the scene.
While anything is still ahead the calendar is unchanged: hours and events, with
the scene at the bottom.

**Alternatives considered** — Keeping the empty hours over a full-bleed scene
(hour labels and lines on the scenery looked cluttered); showing the scene by
clock time only (wrong when an evening event is still ahead); a fade instead
of the slide.

**Tradeoffs** — Once the last event ends you can't draw a new event for later
that night without first revealing the day (tap the pill). The "now" line is
hidden when the day is done; it has nothing to point at.

## 2026-10-29 — Calendar and tasks are only as tall as they need to be

**Problem** — The calendar/tasks row was a fixed 78% of the window. With the past
tucked away and four tasks, that left a large empty block under both cards.

**Decision** — The row is as tall as its content needs, up to the old limit
(78% of the window, 780px), and the two cards always match. In practice the
calendar sets the height: the hours left in the day plus the end-of-day scene.
Mid-afternoon it reaches the limit and scrolls; in the evening it shrinks (about
470px at 8pm, 430px late) and the page below moves up. While the morning is
opened the card keeps the height it had, so revealing it doesn't push the rest
of the page down. The "That's the day" block is sized from the calendar's
measured visible height and is never taller than it, so scrolled to the very
bottom it is always whole (it was cut off when the card was shorter than the
height it had assumed); in a tight space its text compacts: subtitle first, then
a smaller title, then the title goes and the button stays. And it fills: the
scene is the last thing in the calendar and takes every pixel left under the
hours to the bottom of the card, so when the tasks column makes the row taller
than the calendar needs (or no hours remain, late at night) there is no empty
strip under it. Also fixed: the
"Earlier today" pill's box collapsed to zero
height, so its border and hover drew a thin line above the text.

**Alternatives considered** — Making the tasks list fill the extra space (it
would need filler content); a fixed shorter row (still wrong at both ends of the
day); letting the card grow when the morning opens (the page jumped 250px).

**Tradeoffs** — The page below shifts by about an hour of calendar (56px) each
hour as the evening comes in, animated with the same slide. The scene sets a
floor (about 240px) so a nearly-empty evening is still not tiny. If tasks are
few the tasks card still has blank space at the bottom whenever the calendar is
taller; the cards match, they aren't each filled.

## 2026-10-29 — The calendar tucks the past away

**Problem** — By mid-afternoon the top half of the day view was meetings that
were over, taking the room that "what's next" should have. The calendar already
landed on now, but with the line 40% down you were still looking at four hours
of history by default.

**Decision** — By default the calendar starts at the hour before the hour
before now (so one to two hours of the recent past stay in view), and everything
earlier sits above the top edge, unreachable until you ask. Scrolling up at the
top reveals the whole morning, or tap the small "↑ Earlier today · 7 events"
pill; the view doesn't jump when it opens. "Now", or a quiet minute, tucks it
away again. The slide at each new hour is animated. A long meeting that began
before the visible top keeps its title in view. New ⚙ **Past events: Tuck away /
Show** setting, Tuck away by default; Show restores the full day with now 40%
down. The calendar only ever draws today, so there is no previous day to hide;
the evening after the last event it shows the last hour or two and the
"That's the day" scene.

**Alternatives considered** — Just moving the scroll position (the past would
still be one flick away and still counted in the scrollbar); deleting past
events from the page (no way back, and the week strip and Plan tomorrow need
them); fading past events (still takes the space); hiding at exactly one hour
(the hour grid would slide continuously instead of once an hour).

**Tradeoffs** — The first screen shows less of the day's story; the pill is the
only hint that anything is above, so it is always there when there's something
to see. Drag and draw keep working because positions are computed from the
hidden offset (checked: the 8:00pm line gives 20:00). The earlier "now near the
middle at night" rule only applies in Show mode; in Tuck away the line sits an
hour or two from the top and the end-of-day scene fills the rest.

## 2026-10-29 — The weather scene becomes the whole page's background

**Problem** — The starry night, sun, rain and clouds only lived inside the weather
card, but the dashboard sits on a second screen all day, and that is where the
ambience is wanted: across everything, not in one rectangle.

**Decision** — The same scene now fills the viewport behind the whole page
(fixed, so it doesn't scroll away): more stars, a bigger moon or sun tucked in
the top-right corner, more rain and snow, and a soft sky-coloured gradient that
follows the weather (night blue, day sky, rain slate, cloud grey, snow pale). To
let it show through, cards turn lightly frosted (60% surface, a 3px blur) while
it's on. New ⚙ **Background: Scene / Plain** setting, Scene by default; Plain
restores the old look (scene only inside the weather card, opaque cards). Motion
→ Still turns the scene off entirely, as before. With Glass surfaces it layers
with the existing sky tint.

**Alternatives considered** — Opaque cards with the scene only in the gutters
(on a narrow window you'd see almost nothing); fully glass cards by default (the
existing Glass surface, more transparent, but it reads as a different theme);
scene only in the header card (the goal was the whole page); a heavier blur
(it erased the stars behind cards, which was most of the effect).

**Tradeoffs** — Text now sits on a faintly moving background: the cards stay 60%
opaque and the scene is dim, but rain streaks and stars do pass behind text. The
fixed animated layer plus backdrop blur on every card costs GPU on weak
machines; I couldn't measure frame rate in the test pane, so Plain and Still are
the escape hatches. In light theme the night gradient washes the cream a little
purple-grey. Weather sets which scene you get, so on a grey day the background
is quiet.

## 2026-10-29 — The calendar becomes editable; the empty tail of the day becomes "That's the day"

**Problem** — The calendar could only be read. Moving a meeting, stretching it or
adding one meant opening Google Calendar. And the blank scroll room I'd added
below the last hour (so "now" can sit mid-view at night) was dead space.

**Decision** — Drag an event to move it, drag its bottom edge to resize it, or
drag across an empty stretch (or just click it) to draw a new one and type a
name. Everything snaps to 15 minutes, shows the new time while you drag, and
saves only when you let go; a refused save snaps the event back and says why.
The blank tail now holds a small night scene (a lit house under the moon) with
"That's the day.", a line about tomorrow ("6 events · 1 task") and a "Plan
tomorrow →" button that opens tomorrow's agenda and tasks in a card (the same
view the week strip's day panel uses).

**Alternatives considered** — Edit only through the existing detail card (slow,
what we had); a "move to…" time picker (no direct manipulation); Plan tomorrow
as a second calendar column (steals width from today); a streak or stats widget
for the end-of-day space (needs data we don't track).

**Tradeoffs** — Drag is mouse and pen only: on touch, tapping still opens the
detail card, because capturing touch would break scrolling the calendar.
Rescheduling a guest-invited event doesn't notify guests (the write uses
Google's default), and an event on a calendar shared read-only can't be moved,
so you get the error. Recurring events move one occurrence, as before. A drag
onto an overlapping time is allowed; lanes recompute after the save.

## 2026-10-29 — Calendar polish after a day of use: quieter, with a real "Now" button

**Problem** — Using the previous round: the teal sheen sweeping across the clock
digits was distracting; the breathing "Free · 1h" band wanted attention for
information nobody asked for; the "Now" button only appeared after scrolling and
its arrow pointed the wrong way (it showed where you were, not where it would
take you); and late in the evening the now line sat in the bottom half of the
calendar with nothing left to scroll.

**Decision** — Removed the clock's glow and sheen (the seconds still tick in, the
colon still pulses) and removed the Free band. "Now" is a permanent button in the
calendar header; its arrow shows the direction of travel (↑ when the present is
above, ↓ when below, none when you're there). Added scroll room below the last
hour so the now line can always be brought to 40% down, even at 9pm.

**Alternatives considered** — Keeping the band but fading it (still decorative);
a floating button (hides content, easy to miss); top padding too, so the line
could sit mid-view at 6am (blank hours before the day starts looked broken).

**Tradeoffs** — A late evening shows a blank stretch under the last hour. At the
very start of the day the line sits near the top. The ripple and glow on the now
line stay: they're the one always-on signal that the page is live.

## 2026-10-28 — The calendar stays on "now" and is never still

**Problem** — Five small frictions on a screen that is left up all day: the
calendar sometimes wasn't showing the present (you scroll, then it stays
scrolled); with no event in progress the calendar did nothing at all; the thin
progress bar under the current event read as a loading bar; the "sun is down /
sunrise" line under the greeting told you nothing you act on; and the clock had
a breathing effect so faint it was invisible.

**Decision** — (1) The calendar lands on now (40% down), shows a "↑ / ↓ Now"
button whenever the now line is off screen, and drifts back by itself after a
quiet minute or when the tab returns. (2) The now line always glows and its dot
sends out a slow ripple. (3) Free time now is drawn as a softly breathing band
from the now line to the next event, labelled "Free · 1h 20m". (4) The progress
bar is replaced by a faint shade over the elapsed part of the current event. (5)
The sun line is removed. (6) The clock gets a soft glow, a teal sheen that
sweeps across the digits every nine seconds, and a seconds digit that ticks in.

**Alternatives considered** — Auto-scrolling the page itself to the calendar
(jarring, steals scroll); following now continuously (the view would move while
you read); keeping the bar but restyling it; a spinning/pulsing clock face.

**Tradeoffs** — The free-time band is real information (how long you have), but
it adds a colored area to a calm screen; it hides under 10 minutes. The calendar
card can still sit below the fold on a short screen when the weather card stacks
above it: that is a layout question, not fixed here. All motion respects
reduced-motion and the ⚙ Motion "Still" setting.

## 2026-10-28 — Creating a task uses the same form as editing one

**Problem** — Existing tasks had a full Todoist-style editor (priority, due,
project, labels, deadline, duration, notes), but a new task, from "+ Add task"
or from an email, only got a name box (and, for email, priority + date). Making
a task meant creating a stub, then reopening it to finish.

**Decision** — One shared `NewTaskForm` with the editor's fields and look, used
by both entry points. "+ Add task" opens it in a popover; the email's "Make
task" embeds it, still with the optional AI fill (name, priority, date), the
source link prefilled in Notes, and "Take this email off my list". Nothing is
written until Add.

**Alternatives considered** — Create-then-open-the-editor (two writes, a stub
task if you bail); a one-line quick-add with Todoist shorthand (fast but
hides the fields).

**Tradeoffs** — More fields before the first task, so Enter in the name box
still adds immediately. Todoist rejects a duration on a date-only due, so the
server retries without it and the form hints that a due time is needed.

## 2026-10-28 — One copy of an event shared across calendars

**Problem** — An invitation that lands on your calendar and on a calendar shared
with you (e.g. a partner's) came back once per calendar, so the same meeting
showed twice on the day view and the week strip.

**Decision** — Drop duplicates by `iCalUID` + start time (Google's own "same
invitation" id; start is in the key because a recurring series shares one uid).
Calendars are sorted owner → writer → reader → free/busy first, so the copy that
survives is the one you can edit and delete.

**Alternatives considered** — Matching on title + time (would merge two genuinely
different events with the same name); showing both with a "shared" badge (more
UI for something nobody wants to see twice).

**Tradeoffs** — Events without a uid are never merged. If two calendars hold
genuinely separate events with an identical uid and start, one is hidden.

## 2026-10-28 — Retry the Google token refresh when the connection drops

**Problem** — Production still logs occasional Google "fetch failed … other
side closed" errors after the read retry shipped. That retry deliberately
skips anything that isn't a GET, and the token refresh is a POST, so it was
the one Google call with no second chance.

**Decision** — The retry helper takes an `idempotent` flag. The refresh-token
grant sets it, so a dropped connection there is retried once. The one-time
authorization-code exchange does not, and neither does any write.

**Reasoning** — Repeating a refresh is harmless (Google just returns another
access token), whereas repeating a write could duplicate an event or draft and
repeating the code exchange would fail because the code is single-use. The
flag keeps the "never repeat a write" rule intact and makes the exception
explicit and local.

**Alternatives considered** — Retrying every POST (unsafe); leaving the
refresh alone and accepting the occasional blank page (what we had).

**Tradeoffs / open questions** — Unproven until real traffic: it fixes the
refresh path only, so some "fetch failed" errors may remain from elsewhere.

## 2026-10-28 — Week strip: one request per calendar instead of a burst

**Problem** — The retry above did not stop the production errors; they got
louder (25 to 79). Each page load produced a burst of about seven "other side
closed" resets to Google within milliseconds, once a minute (the auto-refresh).
The pattern matched the week strip, which called the full per-day agenda reader
for six days at once: roughly 6 days x 5 calendars = 30 simultaneous event
requests per refresh. A retry cannot fix a burst that is itself the problem.

**Decision** — `getWeekAgendas` asks each calendar for the whole six-day range in
**one request**, then splits events by day (an event spanning days is clipped to
each, same clamping as today's agenda). 6 days across 5 calendars is now 5 event
requests (verified by a temporary counter), and week-ahead data is cached for 5
minutes instead of 1 because it changes slowly. If the read fails, every day
shows "No calendar" instead of the page failing. The strip showed identical
numbers before and after on live data.

**Lesson (for the retro)** — I shipped a fan-out of parallel calls without
measuring its cost against a service with connection limits, then shipped a fix
(retry) for the symptom before confirming the cause. The real signal came from
reading the log *shape* (one burst per request, ~7 failures in 20ms), not the
error count. Check the multiplier on any new "just call it N times" pattern.

**Alternatives** — A concurrency limit on the six calls (keeps 30 requests);
fetching the week less often only (hides the cause); dropping the week strip
(loses a feature people liked).

**Tradeoffs / still unproven** — A very busy week is capped at 250 events per
calendar. Whether this clears the errors is unproven until production runs it:
check the "fetch failed" count in Vercel runtime errors (it was 79).

## 2026-10-28 — One retry for dropped Google connections, reads only

**Problem** — Production logs showed 25 intermittent "fetch failed" errors to
Google since late September (timeouts and "other side closed" resets). Each one
makes that page load fall back to the sample-data marker even though Google was
fine a moment later. The week strip adds six more Calendar reads per load, so the
exposure was about to grow.

**Decision** — `googleFetch` repeats a request **once** (after 300ms) when the
connection itself fails, but **only for reads** (GET/HEAD). Writes are never
repeated, nothing is retried if the caller aborted, and an HTTP error response
(401 refresh aside, which already existed) is returned untouched. The logic lives
in `src/lib/google/retry.ts`.

**Why reads only** — A write whose connection dies may already have been applied
by Google; repeating it could create a second calendar event, a second Gmail draft
or a duplicate label. A failed write should surface as an error the person can
retry on purpose; a failed read is invisible and free to repeat.

**Alternatives** — Retry everything (rejected: duplicate-write risk). Retry on 5xx
too, or several times with backoff (not needed for the failure seen; adds latency
to every slow page). Add idempotency keys to writes (more work than the problem
warrants today).

**Tradeoffs** — A request that fails twice still fails, now ~300ms later. The
Google token refresh call (in `oauth.ts`) is not covered. Whether this cuts the
error rate is unproven: check the "fetch failed" count in the Vercel runtime
errors over the next weeks.

## 2026-10-28 — Experiment: vertical calendar beside today's tasks (bottom area only)

**Problem** — The horizontal day arc reads differently from the calendar people
already know (Google Calendar's day view), so every glance costs a little
translation. And the bottom area split attention three ways (tasks, plan,
replies) when the daily loop is narrower: "what is my day, and what do I need to
do in it?"

**Decision (experiment branch)** — Everything at the top stays exactly as it was:
greeting and day note, weather, the attention strip (with its email actions) and
the week strip. Only the lower area changes: the day arc and the three columns are
replaced by a **vertical day calendar** (hours down the left, events sized by
duration, overlapping events side by side, a line at the current time, opens near
now) next to **Today's tasks**, each scrolling on its own. The Now/Next readout and
the Focus timer moved into the calendar header. Clicking an event or task opens
the same detail editors as before. "Needs a reply" (the list) and "Plan" are
**archived**: the components stay in the repo, just not rendered.

**Follow-up: calendar higher on the page** — With the week strip above it, the
calendar started 686px down (barely visible on a 900px screen). The week strip
now sits **below** the calendar and tasks (they start at 465px, about 435px of
them visible on first load). Rationale: the week is look-ahead context, the
calendar and tasks are what you act on, and the first screen belongs to action.

**A misreading worth recording** — The first version removed everything except the
two panels, reading "leave only these two" as the whole page. The intent was only
the bottom blocks. Lesson: when a layout request is ambiguous about scope, restate
which regions are changing before building.

**Why vertical** — It matches the Google Calendar mental model, makes length and
overlap obvious (height and side-by-side width), and pairs naturally with a task
list as two independent columns.

**Alternatives** — Keep the horizontal arc beside the tasks (wide-and-short
doesn't share a row with a list). Keep Plan for AI scheduling (archived for now;
its code and route remain).

**Tradeoffs / open questions** — With the reply list archived, replies are
reachable only through the attention strip's popover (it still offers Reply, Draft,
Wait, Move, Trash). "Plan with AI" is unreachable. Free-time labels and conflict
marks from the horizontal arc are not ported (side-by-side lanes show overlaps; the
strip still reports conflicts). The calendar sits below four rows of summary, so on
a short screen it starts below the fold: does it need to move up?

## 2026-10-27 — Restraint pass: warm neutral, flat cards, solid by default

**Problem** — The default look (frosted glass over radial color orbs, 22px
corners, a drop shadow on every card, a sky gradient behind the day arc)
competed with the content. The product is the schedule, not the chrome.

**Decision** — Warm neutral canvas (`#F4F1EA`) with off-white cards (never pure
white), hairline borders instead of shadows, corners 12/8/6px, a flat day-arc
band, and one accent (the existing teal). Surfaces now default to "solid";
Glass stays available under ⚙ → Surfaces. Added a global teal focus ring, and
draft Privacy and Terms pages linked from the footer.

**Alternatives** — Remove Glass entirely (rejected: it is a working opt-in
setting). Change the typefaces (rejected: Bricolage + Jakarta already give the
brand its own voice).

**Tradeoffs** — This intentionally departs from the verbatim reference tokens
(canvas, surface, line, ink, radii, shadow, light-mode band). Dark mode tokens
are unchanged. Legal text is a draft and needs a real review.

## 2026-10-27 — Editorial experiment: ruled sections, headline greeting, line-coded events

**Problem** — After the restraint pass every section was still the same boxed
card, and the saturated blue/amber event blocks out-shouted the greeting.

**Decision** — On Solid, cards lose their box and become sections under a 1px
ink rule with small uppercase titles. The greeting becomes a page-sized
headline directly on the canvas, and the day note is plain text. Calendar kinds
are told apart by line and tone, not hue: meeting = outlined, focus = accent
fill, personal = dashed. One block at the end of `globals.css`; delete it to
return to cards. Glass is unaffected.

**Alternatives** — Keep colored blocks but mute them (safer, less distinct).

**Tradeoffs** — Kind is no longer readable at a glance by color alone; the
legend carries the mapping. Less container structure means the headline and
rules do all the grouping work. Contrast of outlined blocks not formally measured.

**Follow-up (same day)** — The first cut of the editorial pass read as a
landing page: a 112px headline pushed the tasks, plan and replies below the
fold. For a productivity tool the work comes first, so the greeting is now a
normal 30–42px heading, section rules use the quiet `--line` color instead of
ink, and spacing is tighter. Rule of thumb going forward: nothing decorative
may push actionable content off the first screen.

**Second follow-up (same day)** — Ruled, unboxed sections felt too bare to
scan comfortably. Cards are back on Solid: flat, 1px border, 12px corners,
24px padding, no shadow, on the warm canvas. Events use a muted tint of one
quiet hue per kind (slate blue / accent teal / warm gray) with ink text, so the
day arc has color without saturated slabs. The compact greeting stays.

## 2026-10-27 — "What did I miss?": attention strip + a day arc that reads gaps and conflicts

**Problem** — The dashboard is left open on a second screen all day, and its
first job is to answer "what did I miss?". Eight equal cards made the viewer
hunt for it, and the day arc (the most-used part) showed events but not the
space between them or where they collided.

**Decision** — A "Needs attention" strip directly under the header lists, in
order: schedule conflicts, tight turnarounds (<10 min), overdue tasks (rolled
into one line so a backlog can't flood it) and replies (blocking first). Each
item jumps to its card. When nothing is wrong it says so in one quiet line. On
the arc: open stretches (≥20 min) are labelled "1h free", overlaps get a red
mark under the band, and a "Now / Next" readout sits in the header. All logic
is pure (`src/lib/attention.ts`) and uses only data already fetched.

**Alternatives** — Overdue ticks on the arc (rejected; tasks aren't calendar
events, see the earlier removal); one strip item per overdue task (rejected:
noisy); browser notifications (deferred: needs permission and adds noise).

**Tradeoffs** — Overdue means date-based only (a timed task earlier today is
not flagged). The strip counts replies as of the last server render, so a
trash/move updates it on the next refresh, not instantly.

## 2026-10-27 — Week strip and a local focus timer

**Problem** — A dashboard left open all day shows today only, so a heavy
Thursday is a surprise on Thursday. And the list of tasks never turns into
protected time.

**Decision** — *Week strip:* seven day columns (today + six), each a two-part
bar (booked hours, then tasks due at ~30 min each) with the numbers in words
underneath and "Heavy" spelled out at 6h+ of load, so nothing relies on color.
It reads six extra calendar days and one extra Todoist query, in parallel, and
fails to blank only itself. *Focus timer:* start from the arc toolbar ("Focus
25") or from a task's editor ("Focus on this", using its Todoist duration, 5–120
min). It shows in the arc header (pause / stop), as a dashed block on the band,
and in the tab title. State lives in this browser's localStorage only; nothing
is written to Google or Todoist.

**Alternatives** — Click a day to load it into the arc (deferred: the page is
server-rendered for today only). Writing the focus block to Calendar (rejected
for now: an unasked write; the Plan card's Block already does that
deliberately). Browser notifications at the end (deferred).

**Tradeoffs** — The 6h "heavy" line and the 30-min-per-task estimate are
heuristics, not settings. The timer is per-browser, so a second screen won't
see it. Week data costs six more Calendar reads per refresh (cached).

## 2026-10-27 — Attention items open the emails, with actions

**Problem** — Clicking "Blocking" or "Waiting" scrolled to the reply list and
left you to find the right emails. Seeing a problem and acting on it were two
separate steps.

**Decision** — Reply items in the strip now open a popover with just those
emails and an action on each: Reply in Gmail (opens the message), Wait a day,
Move… (labels, or a new one) and Trash (two-step). Dealt-with emails leave the
popover, the strip and the reply list at once; the popover closes when it is
empty. Non-reply items (conflicts, overdue) still jump to their card.

**"Wait a day"** is a local snooze: it hides the email from this dashboard for
24 hours, remembered in this browser only. It does not change Gmail (no label,
no archive), so the email is still in your inbox and returns on its own.

**Alternatives** — Scroll to the list and highlight the matches (the first
idea; the popover makes it unnecessary). Compose replies inside the dashboard
(deferred until the AI drafting work, which needs Gmail draft permission).

**Tradeoffs** — Snoozes are per-browser, like the focus timer, so a second
screen won't share them. A snooze that expires while the page is open is picked
up on the next load.

## 2026-10-27 — AI reply drafts (OpenAI-compatible model, saved as Gmail drafts)

**Problem** — The reply popover could open, snooze, move or trash an email but
not help write the answer, which is the slow part.

**Decision** — A "Draft reply" action in each email row (shown only when
`LLM_BASE_URL`, `LLM_API_KEY` and `LLM_MODEL` are set and Google is connected).
It takes an optional one-line steer ("say yes, suggest Thursday"), writes a
short first-person reply, and shows it in an editable box. "Save to Gmail
drafts" creates a threaded draft; nothing is ever sent from the dashboard. The
model is any OpenAI-compatible chat API, so it works with Dartmouth Chat.

**Safety** — The key is read only in server code and never reaches the
browser; it lives in gitignored `.env.local` (and, if deployed, only in the
private deployment's env, never the public demo). The routes fail closed (400)
unless the model and Google are both configured, accept same-origin requests
only, validate the message id, cap input (6,000 chars of email body, 12,000
total) and output, and allow 30 drafts per hour. Errors never echo mail text
and nothing is logged. The prompt tells the model the email is untrusted and
not to follow instructions inside it; since the output is only a draft a human
reads, a malicious email can't make the dashboard act.

**Privacy** — Only the sender, subject and body of the one email being
replied to leave the machine, to the model's provider. Pick a model hosted by
the school (not a third-party cloud model) if that matters for a given inbox.

**Alternatives** — Auto-reply or send (rejected: too risky). A new Gmail scope
(not needed: `gmail.modify` already covers creating drafts, so no reconnect).

**Tradeoffs** — The hourly cap is in-memory, so it resets when the server
restarts. A draft is only as good as the model; it is written to leave
bracketed placeholders instead of guessing facts.

## 2026-10-27 — "Plan with AI": suggested schedule, confirmed one block at a time

**Problem** — The Plan card's suggestions are mechanical: highest priority
first, always at the start of a gap. It can't say why, can't spread tasks
across the evening, and can't weigh deadlines against effort.

**Decision** — A "Plan with AI" button on the Plan card sends the model only
task names, lengths, priorities, due dates and today's open gaps (no event
titles, no mail). It returns up to six suggestions, each with a time and a
one-line reason, shown as a "Suggested plan". Each row has its own **Block**
(the existing action that creates the calendar event) and a dismiss; nothing
is placed until that click, and the Todoist task is never changed.

**Safety** — The model's answer is never trusted: the server drops any
suggestion that names an unknown task, repeats a task, starts in the past,
doesn't fit entirely inside an open gap, or overlaps another suggestion, and
always uses the task's own length (never one the model picks). It uses the
same guards as drafting (both integrations configured, same-origin, hourly
cap, fail closed). Task names are marked as data, not instructions.

**Fixes found while testing against the real model** — It rejects a custom
temperature (removed), and its token budget includes hidden reasoning, so
budgets were raised (drafts too) and a cut-off answer now keeps the complete
suggestions that arrived before the cut.

**Alternatives** — "Block all" in one click (rejected: you asked to confirm
each). Letting the model choose durations (rejected: it would invent them).

**Tradeoffs** — Suggestions are a snapshot: after the day moves on, ones in
the past disappear, and Clear returns to the standard open-time view.

## 2026-10-07 — An expired Google sign-in says so, instead of showing sample mail

**Problem / trigger** — Gmail (and the calendar) went back to sample data
again. Google can reject the stored *refresh* token itself (`invalid_grant`:
revoked, or — while the OAuth consent screen is in "Testing" — expired after
7 days). The 401 self-heal from 2026-09-30 only covers a bad *access* token,
so this failure was swallowed and the cards just showed the generic "Sample"
tag, which reads like an outage rather than "you need to sign in again".

**Decision** — Dead-connection failures are now a distinct case
(`GoogleAuthError`: not connected, no refresh token, or `invalid_grant`).
`getDashboardData` reports it as `googleReconnect`, and on the Plan and
Needs-a-reply cards the amber "Sample" pill becomes a **Reconnect Google**
link to `/api/auth/google` (which already forces a fresh consent). Other
failures keep the plain "Sample" pill.

**Reasoning** — The marker should tell you what to do, not just that
something is wrong. Reusing the existing pill keeps the card chrome
unchanged, and one click replaces typing two URLs.

**Alternatives considered** — A banner across the page (louder than one
expired integration deserves); an automatic redirect to consent (surprising
on a dashboard that auto-refreshes every 60s); extending `SliceSource` with
a fourth state (touches every card for a Google-only concern).

**Tradeoffs / open questions** — The root cause for a Testing-mode consent
screen is the 7-day expiry; the real fix is publishing the OAuth app
("In production") in Google Cloud, after which this link should rarely show.

---

## 2026-09-30 — Glass surfaces, on by default with a Solid switch

**Problem / trigger** — Wanted the dashboard to feel cleaner and more
modern, in the style of Apple/Microsoft "material" glass UIs; shared NN/g's
*Glassmorphism: Definition and Best Practices* as the brief.

**Decision** — A glass layer on top of the reference stylesheet rather
than a rewrite of it: cards become frosted (translucent gradient fill,
28px background blur + saturation, a faint light edge and a top highlight
for thickness) over a soft, fixed ambient backdrop (mint / sky / peach
glows in light; deep green / blue / amber in dark). Popovers are more
opaque and blurrier. It's the default, with ⚙ → Surfaces → Solid
restoring the reference's opaque cards, and the OS's "reduce
transparency" / "increase contrast" settings forcing Solid automatically.

**Reasoning** — Straight from the article: glass needs something behind it
("glassmorphic elements stand out when placed in front of gradients"), so
the backdrop is part of the design, not decoration — and because we control
it, it stays calm, which keeps text contrast predictable ("if you have
control of what appears behind a translucent component, opt for simple
backgrounds"). Heavy blur because "more blur is better". Opacity kept high
(~60–80%) so the existing ink colors keep their contrast. Glass is applied
to surfaces only — the day arc, event colors and chips are unchanged — per
"best when utilized sparingly". The Solid switch and OS-setting fallback
are the article's "let users adjust transparency".

**Alternatives considered** — Restyling the reference CSS in place (loses
the clean separation that lets a design re-port still apply); glass on
every element including chips and event blocks (busier, and hurts the
calendar color language); a photo or animated backdrop (the article warns
busy backgrounds hurt readability and focus).

**Tradeoffs / open questions** — `backdrop-filter` costs GPU on large
blurred areas; fine on modern hardware, but a very old device may prefer
Solid. The ambient backdrop only shows in the gaps between cards and
through them, so the effect is deliberately subtle. `prefers-reduced-
transparency` isn't supported in every browser yet; where it isn't, the
Solid switch is the manual fallback. *Follow-up, same day:* extended to the
calendar at the user's request — event blocks became tinted glass (kind
color kept at ~88% so text contrast holds, a lighter top for sheen, a thin
inner light edge, a shadow in their own color, a light blur), overlap
strips got a frosted separator ring instead of the solid one, and the
daylight band became a translucent track. The band first went too pale on
the light glass card at ~58% opacity; raised to ~80% with slightly richer
stops so the time-of-day colors still read. *Then:* the tinted-glass blocks still
"looked a little weird" — saturated slabs with white text, just glossier,
clashing with the airy cards. Switched to how Apple Calendar / Fluent
style events on glass: a light tint of the kind color (~20–30%) over
frosted glass, a solid 3px color bar on the leading edge, and text in a
deep shade of the same color (a light shade in dark mode). The color
coding survives via the bar + tint + text hue; the blocks now read as
part of the glass. Solid mode is unchanged (reference colors). *And then:*
the blue/amber/slate kind colors themselves felt unappealing in glass.
Glass now uses a pastel triad — periwinkle meetings (#6C8EF0), apricot
focus (#EE9A4E), orchid personal (#D576AE), lighter variants in dark —
taken from the Okabe–Ito colorblind-safe palette (blue / orange /
reddish-purple) so the reference's "never red-vs-green" rule still holds.
Block text is a deep shade mixed toward black (58%) so even the apricot
holds 4.68:1 on its tint; the popover's kind label mixes toward --ink.
Solid mode keeps the reference colors. *Last tweak:* the orchid pink didn't land —
personal is now mint/teal (#3FAE95; #7FD6C1 in dark), Okabe–Ito's
bluish-green, still colorblind-distinct from periwinkle and apricot
(text 5.16:1 on its tint).

---

## 2026-09-30 — Wind down: no work after 9pm

**Problem / trigger** — The user didn't want the dashboard pointing at
work late at night ("focus on …" at 10pm).

**Decision** — A ⚙ "Wind down at" setting (default 9pm, 24 = off). From
then on the day note is a wind-down line in the chosen voice ("That's it
for today — time to wind down."; if an event is still running: "Last thing
on the calendar wraps at 10:30pm — then wind down.") and the Plan card
replaces its suggestions with "Done planning for today". Before it, free
time and Plan suggestions only run up to wind-down ("2h 15m free until
9pm"), so nothing gets scheduled past it. No AI call after wind-down.

**Reasoning** — A morning dashboard left open in the evening shouldn't
nag; the calendar countdown stays because events are commitments, tasks
aren't. Capping free time at wind-down keeps the numbers honest.

**Alternatives considered** — Hard-coding 9pm (user asked for a setting);
blanking the note entirely (a gentle line reads better than an empty box).

---

## 2026-09-30 — Day note: no more "unusually open day"; mail self-heals

**Problem / trigger** — Two things on the live dashboard: the note said
"Nothing scheduled and nothing urgent — an unusually open day" while a
task was still on the list, and the mail card showed sample emails.

**Decision** —
- The note only considered Urgent/Normal tasks; with just a Someday task
  left, it fell through to that line. Now it falls back urgent → normal →
  someday, and a truly empty list gets per-voice lines ("4h 35m free until
  10pm — your list is clear.", "Your list is clear — enjoy the evening.",
  "No meetings left and no tasks."). Briefly removed the "Shape of the
  day" label, then kept it — the user wanted new wording, not a new frame.
- Google had invalidated the stored access token before its recorded
  expiry; the app trusted the expiry and kept sending a dead token, so
  Gmail 401'd and the card fell back to sample mail. All Google calls now
  go through `googleFetch`, which refreshes and retries once on a 401.
- With mail live again, the inbox was only `vercel[bot]` PR notifications
  (Gmail marks them Important). Bot senders are now always dropped — they
  never need a reply — so the card honestly shows "Inbox is clear".

**Reasoning** — Each was the UI saying something untrue (an "open day"
with work left; "sample" mail on a connected account; bots "needing a
reply"). Self-healing auth beats a "reconnect Google" prompt because the
refresh token was fine.

---

## 2026-09-30 — The agenda becomes a Plan card

**Problem / trigger** — Once the day arc showed names, times and locations,
the agenda card was the same information twice. The question: what would
make that column genuinely useful?

**Decision** — A Plan card: a countdown to the next event, then today's
open gaps, each with Todoist tasks that fit, and one-click **Block** to put
a task on the calendar. Refined after first use:
- Block originally pre-packed suggestions back to back (5:20 / 5:50 /
  6:20), so blocking the third landed an hour out. Now suggestions carry no
  time; Block always uses the start of the gap (now, rounded up to 5 min),
  and the gap shrinks for the next one.
- "Up next" named the event; the arc already does that. It's now a
  name-free countdown ring (drains over the last hour; inside an event it
  shows time left).
- A blocked task vanished from the card and read as "marked done". Block
  only creates the event; blocked tasks move to a **Scheduled** list with
  **Unblock** (deletes just the event). Todoist is never written to.

**Reasoning** — It's the only card that connects tasks to time, which is
the actual morning question ("what do I do with the next hour?"). Each
refinement removed a mismatch between what the UI implied and what it did.

**Alternatives considered** — "This week" deadlines strip, quick capture,
habits/streaks, meeting prep, a focus timer — all still on the table; the
Plan card was the highest-leverage start.

**Tradeoffs / open questions** — Suggestions only draw from today's /
overdue tasks (the Todoist filter); no buffer around meetings yet.

---

## 2026-09-30 — One row style for tasks, mail and plan suggestions

**Problem / trigger** — Plan suggestions were soft rows that highlighted on
hover; tasks and emails were divider-separated lines whose names turned
teal on hover. Inconsistent, and the teal text read as unappealing.

**Decision** — One shared row style: rounded rows, no divider lines, a
neutral highlight on hover (a frosted white chip with a faint shadow in
glass, a light grey tint in solid) and no colored text on hover or
selection.

**Reasoning** — The row, not the text, is the interactive object; a
neutral lift reads as "this is clickable" without spending the accent
color, which stays reserved for state (today, active toggles, Block).

---

## 2026-09-30 — Rewording the shape-of-the-day note, with a voice setting

**Problem / trigger** — The fallback note's "… is the one thing worth
finishing" felt off.

**Decision** — Three voices in ⚙ → Day note: **Timely** (default — "3h 45m
free until 10pm — focus on **Task**"; "get started on" when the task's
duration won't fit), **Gentle** ("The rest of the day is yours. Start
with **Task**.") and **Plain** ("No meetings left; your top priority is
**Task**."). No quotes around task or meeting names; the task is bold.
The AI prompt follows the chosen voice and the same formatting.

**Reasoning** — Timely says something you can't get at a glance (real free
time, from the same math as the Plan card). Bold replaces quotes: long
task names in quotes read heavy, but bare names blur into the sentence
because they start with verbs.

---

## 2026-09-30 — Teal accent in glass mode

**Problem / trigger** — The site-wide accent (date, "shape of the day"
note, active toggles, links, location dot) was the reference's green; the
user wanted teal.

**Decision** — Glass overrides `--accent` / `--accent-tint` with teal
(#0B6F75 / #E2F2F3 light, #4DC3C4 / #163134 dark) and adds
`--accent-deep` for the note's text (the reference hard-codes a deep
green there). The ambient backdrop's green glow shifted to teal to match.
Solid keeps the reference green.

**Reasoning** — The accent carries small text, so it had to stay dark
enough: a first teal (#0E7A80) put the 10px "SHAPE OF THE DAY" tag at
4.43:1 on its tint, just under AA; #0B6F75 gets 5.9:1 on white and 5.1:1
on the tint (dark: 6.5:1). Scoped to glass, like the calendar palette, so
Solid remains a faithful fallback to the reference.

**Alternatives considered** — Changing the reference tokens globally
(simpler, but Solid would stop matching the design source); a brighter
cyan (reads more "teal" but fails contrast for small text in light mode).

**Tradeoffs / open questions** — Teal sits near the calendar's mint
"personal" color; they're different enough in lightness and use (text/UI
vs event fills), but worth watching. *Follow-up, same day:* the user
wanted teal everywhere, Solid included — the reference's accent tokens
(and its hard-coded deep-green note text) now carry the teal directly,
noted in the globals.css header as a deliberate divergence from the
source, and the glass-only override was removed.

---

## 2026-09-30 — Task-due ticks removed from the day arc

**Problem / trigger** — The arc's legend had a fourth entry, "task due",
with small dots on the timeline for Todoist tasks with a due time. Tasks
aren't calendar events — the user doesn't put them on their calendar — so
a calendar color and marker for them read as noise.

**Decision** — Removed the legend entry and the dots (and the now-unused
`buildArcTasks` / `tasks` prop). Tasks live only in the Today's tasks card.
The ticks row stays as an empty spacer, since the NOW pin reaches into it.

**Reasoning** — The arc should mirror the calendar the user actually
keeps; a second kind of mark with its own color diluted the color language
the recent glass/pastel work was sharpening.

**Alternatives considered** — Keeping the dots but dropping the legend
(unexplained marks); showing due-tasks as outlined pseudo-events (more
calendar-like, but still implies they're scheduled when they aren't).

**Tradeoffs / open questions** — This diverges from the reference design,
which had the ticks. If time-specific tasks start mattering on the
timeline, they could come back as an opt-in setting.

---

## 2026-09-30 — Scrolling day arc with bigger bubbles, on by default (trial)

**Problem / trigger** — Even with "Expand" available, the default arc
squeezed a packed day into the card's width, so most blocks carried only a
clipped name. The ask: make the bubbles bigger when needed and let the
calendar scroll sideways, so each one can say more.

**Decision** — Expanded is now the default (an explicit "Fit day" is
remembered). The zoom sizes the day so its shortest event gets ~150px,
capped at 280px/hour, and **never less than the card's own width**: a
day that already fits doesn't scroll at all. Lone bubbles grow to 100px
tall and show the name (2 lines), the time *range*, and a location / call /
attendee line. Scrolling gets a soft fade on whichever edge has more day
beyond it, plus click-and-drag panning for mouse users (a mouse wheel can't
scroll sideways; trackpads and touch already can). A drag never opens an
event; a click still does.

**Reasoning** — "Bigger if needed" maps directly to max(needed, fits): the
scroll only appears when the day is dense enough to deserve it. The fades
answer "is there more?" without extra UI chrome. Drag-to-pan beats hijacking
the vertical wheel, which would trap page scrolling whenever the pointer
crosses the arc.

**Alternatives considered** — Converting vertical wheel to horizontal
scroll (traps page scroll); ‹ › arrow buttons (more chrome, slower than a
drag); making the whole card taller instead of wider (doesn't fix the
horizontal squeeze that causes clipping).

**Tradeoffs / open questions** — A dense day becomes several card-widths
long (today: 4480px), so you see a window of the day, not all of it.
"Fit day" is the escape hatch; whether expanded stays the default is the
point of this trial. *Update, same day:* after using it, 4480px felt like
too much scrolling — dialed back to ~120px per shortest event and a
200px/hour cap (today: 3200px, about 30% shorter); bubbles still carry
name, range and location. Overlap strips still show one line (name + range);
the front strip has spare height that could carry the location too.

---

## 2026-09-30 — Short events on the day arc: always name them inside, and an "Expand" zoom

**Problem / trigger** — The day arc is a single horizontal strip scaled to
fit the card, so a 15–30 minute event is a sliver. Three rounds of fixes
chased where its name should go: first below the band (read as broken,
collided with neighbours), then inside-or-beside with a hard cut-off (a
block under 44px still showed nothing inside). The feedback each time was
the same: the block itself should say *something*, and it'd be nice to see
the day "expanded" when it's crowded.

**Decision** — Two parts. (1) A block always shows at least the start of
its name inside, chosen by its real pixel width (CSS container queries, not
% of the day): wrapped text when there's room; under 44px, the name written
*vertically* in a lone block (tall and thin) or a single faded line in an
overlap strip (short and thin); blank only under ~14px. Overlap strips drop
the time entirely rather than clip it to "1:0". (2) An "Expand" toggle in
the arc header zooms the timeline so the day's *shortest* event gets ~96px
(clamped 90–200px/hour), makes the band taller for roomier overlap strips,
scrolls sideways, and opens on "now". Remembered per browser.

**Reasoning** — Every earlier attempt moved the name *away* from the block,
which breaks the one-glance mapping between a block and its label. Vertical
text uses the dimension a thin block actually has. For the zoom, sizing to
the shortest event makes it adaptive: a sparse day barely zooms, a packed
one zooms more — no zoom slider to fiddle with. Opening on "now" matches
why you look at a morning dashboard.

**Alternatives considered** — Initials ("ETM") in tiny blocks: compact but
unrecognizable next to the real names. A zoom slider or +/- buttons: more
control than a glanceable dashboard needs. Auto-trimming the day to
first-to-last event ("fit to events"): helps, but changes the scale under
you as the day's events change; could still be a later option. A vertical
Google-style day view: a different layout entirely, not the design's arc.

**Tradeoffs / open questions** — Vertical text is slower to read than
horizontal; it's a fallback, and the tooltip / popover / agenda carry the
full name. Expanded mode means the whole day is no longer visible at once —
hence a one-click toggle back ("Fit day") rather than making it the
default. The expand preference is per browser (localStorage), not in the ⚙
settings cookie, since it's a viewing convenience rather than a setting.

---

## 2026-09-28 — A PR that GitHub called "merged" but wasn't, and why

**Problem / trigger** — Asked to change the day-arc window to 8am–midnight,
the answer should have been "open the ⚙ panel, type 8 and 24" — that
feature had already been built and merged as PR #16. Instead, the live
dashboard still showed the old 6am–10pm default, and `settings.ts` on
`main` had no `dayStart` field at all. `gh pr view 16` reported
`state: MERGED`. The code told a different story.

**What actually happened** — PR #16 had been built stacked on PR #15's
branch, then split off cleanly with `git revert` once I noticed the
mis-scoping (logged at the time). That revert was the right call for #15,
but it meant #16's branch and #15's branch shared a git ancestor commit
that later got *undone* on #15's side. When #16 was merged sometime after
#15 and #17 had already landed, git's own duplicate-change detection
(triggered by that shared, since-reverted ancestor) treated #16's entire
commit as a no-op and merged an empty diff — no conflict, no error, just
silently nothing. `gh`/GitHub still recorded a merge event and a "MERGED"
state, because from GitHub's side, a merge genuinely happened — it just
didn't change any files.

**Decision** — Don't try to rebase or cherry-pick out of that history
(confirmed firsthand: rebasing the old branch onto current `main`
reproduced the exact same empty-merge behavior, for the same reason).
Rebuilt the feature as fresh edits against current `main` instead, verified
line-by-line against what the original PR was supposed to contain, and
shipped it as a new PR rather than trying to reconcile the broken one.

**Reasoning** — Once git's history contains a commit and its own exact
revert, that commit is permanently "cheap" to silently no-op in any future
rebase/merge that can see both — fighting that is more fragile than just
re-authoring the (small, well-understood) diff cleanly. A "merged" PR
state is a claim about what GitHub *did*, not a guarantee about what
changed — worth verifying by grepping for the actual expected code, not
just trusting API/UI status, especially for anything that was built by
stacking one branch on another mid-session.

**Tradeoffs / open questions** — This class of bug is specific to the
stack-then-split-via-revert pattern used earlier that same day. Since PRs
here are usually short-lived and merged quickly, the safer default going
forward is to avoid the mistake in the first place (double-check `git
status`/`git branch --show-current` before every commit) rather than
relying on revert-based cleanup once multiple stacked branches exist.

---

## 2026-09-27 — Configurable day/weather window, and decoupling the two

**Problem / trigger** — The day arc's 6am–10pm span and the weather card's
hourly range were the same fixed number, both baked into env config. The
tracked day actually starts around 8am and ends around midnight; separately,
showing weather from 6am is noise — nobody's checking the forecast before
they're up.

**Decision** — `dayStart` / `dayEnd` / `weatherStart` join the existing
settings model (URL query → cookie → this deployment's `DASHBOARD_ARC_FROM`/
`ARC_TO` → a hardcoded fallback), editable from the same ⚙ panel. Weather
gets its *own* start, independent of the arc's, but always shares the arc's
end — there was no complaint about weather cutting off too early, only
starting too early.

**Reasoning** — Folding these into the *existing* settings/cookie system,
rather than inventing a new mechanism, was close to free: the precedence
chain, the persistence, and the panel were all already built for
theme/density/time. The harder call was *not* reusing the day arc's window
for weather too, even though they'd always been the same number — once
you're asking "when does my day start," "when do I want to see the
forecast start" is a related but different question.

**Alternatives considered** — A single shared "day window" with weather
just inheriting it (the status quo, just made configurable) — rejected
because it doesn't fit the request: an 8am–midnight day with a 6am weather
start needs two numbers, not one made editable.

**Tradeoffs / open questions** — `dayEnd` support stops at `24` (midnight,
the same calendar day) rather than allowing a day that runs into the next
calendar day — the latter needs actual date-rollover handling for
agenda/task times, which nothing asked for yet. Caught and fixed a real
latent bug along the way: `formatHour` collided hour `24` with noon, both
reading "12:00pm" — never triggered before because `arcTo` had never been
anything but a mid-window value like `22`.

---

## 2026-09-27 — Editing calendar events: scope, single-occurrence semantics, and what's out

**Problem / trigger** — The agenda/day-arc's event popover was read-only.
Mirroring the just-shipped Gmail actions, the ask was to delete and
reschedule events from the dashboard directly, plus edit "as seen in
Google Calendar" where reasonable.

**Decision** — Widened the Google scope to `calendar.readonly` +
`calendar.events` (not the broader `calendar` scope, which also grants
creating/deleting/sharing whole calendars — a much bigger blast radius than
"edit events"). The event popover became a real editor: rename, reschedule
(date + start/end time), location, description, and delete with a confirm
step. Deliberately **not** editable here: guests, reminders/notifications,
and recurrence — `event.htmlLink` ("Open in Calendar") is the escape hatch
for anything not covered.

**Reasoning** — Delete/reschedule were the explicit ask; guests and
recurrence editing are a different order of complexity (recurrence
specifically needs a "this event / this and following / all events"
chooser, which Google Calendar itself surfaces as a whole separate dialog)
for something that wasn't the actual request. Building those without being
asked would have been speculative scope, not responsiveness.

**A real bug this caught before it shipped** — Event ids were built from
`{calendarIndex}:{eventId}`, where the index was just the array position
from that render's `discoverCalendarIds()` call. Once auto-discovery
replaced an explicit calendar list, that order was never guaranteed stable
between requests — an edit or delete could silently target the *wrong
calendar's* event if discovery happened to return a different order
between the read that produced the id and the write that used it. Fixed by
encoding the real calendar id in the composite id instead of a position.
Caught during implementation, before any write functionality existed to
expose it — a good example of a change (multi-calendar merge) quietly
setting up a bug in a *different*, later feature (editing) that hadn't
been built yet when the first change shipped.

**Alternatives considered** — The full `calendar` scope (simpler — one
scope instead of two) — rejected on the same least-privilege reasoning as
`gmail.modify` vs. `mail.google.com`: grant exactly the capability being
built, not the most convenient scope that happens to include it.

**Tradeoffs / open questions** — Deleting or rescheduling a recurring
event's instance from here always acts on that single occurrence — there's
no way from this card to edit "all future instances," matching Google
Calendar's own default behavior but not its full flexibility. If that gap
turns out to matter in practice, it's the natural next scope to add.

**Found in live testing, not fixable in this app** — Writes fail with a
bare `403 Forbidden` against the account used to test this (a Google
Workspace / school-managed address), even though: the token is freshly
minted with the correct scope, and the account is confirmed the organizer
of every event tested. Reads and Gmail's `gmail.modify` writes work fine
on the same account. That combination — correct auth, correct ownership,
still blocked, and only for one specific API — is the signature of a
Workspace admin's API access-control policy restricting third-party apps
from writing to Calendar specifically, not a bug in this app's OAuth flow
or request shape. Nothing to fix here; the error message was rewritten to
say so plainly instead of surfacing a bare status code, since a personal
(non-managed) Google account should hit no such wall.

---

## 2026-09-27 — Making Trash/Move feel instant, after real use surfaced the lag

**Problem / trigger** — Using the just-shipped Trash/Move actions for real,
two things felt slow: the label picker had a visible loading beat every
time "Move…" was clicked, and clicking Trash or a label left the row
sitting there for a moment before it actually vanished. Neither was a
one-off — they were structural, in how the previous pass built the feature.

**Decision** — Two separate fixes for two separate causes:
1. Fetch `/api/replies/meta` once, on the card mounting, into a
   module-level cache — not lazily inside the popover the first time it
   opens. By the time anyone can click "Move…", the labels are already in
   memory; the popover has nothing left to wait on.
2. Stop rendering a cleared reply the moment its action *succeeds*,
   rather than waiting for the `router.refresh()` that follows to
   reconcile server state. That refresh re-fetches the whole page's data —
   weather, tasks, calendar, everything — not just this one row, so tying
   the row's disappearance to it meant a visibly slow remove for a change
   that's conceptually just "hide this one thing."

**Reasoning** — Both are the same underlying lesson: *don't make the
user's perceived latency equal to a slower system's actual latency* when
the two aren't really coupled. The label list doesn't need to be fetched
per-interaction — it changes rarely, so loading it once, early, and
reusing it removes the wait entirely instead of just hiding it better. The
cleared row doesn't need to wait on the *entire* page's server round-trip
to know it should disappear — the outcome of one write is enough
information on its own.

**Alternatives considered** — For the row removal, keeping the optimistic
*dim* (the original `.reply--cleared { opacity: 0.4 }`) instead of an
outright hide, so a failed request had a visibly "in-flight" row to revert.
Replaced instead with: hide immediately, and on failure, un-hide it and
surface an inline error — the success path (the overwhelmingly common one)
gets full-speed feedback, and failure still recovers cleanly, just via a
different visual state instead of a lingering dim.

**Tradeoffs / open questions** — The label cache is seeded once per page
load and never invalidated — a label renamed or deleted in Gmail directly
won't show up here until the next full reload. Acceptable for how rarely
labels change relative to how often the card refreshes; worth revisiting
if that assumption stops holding.

---

## 2026-09-27 — Trash / move-to-label on "Needs a reply" (and a hover-visibility miss)

**Problem / trigger** — The inbox card was read-only: seeing a message that
didn't need attention meant switching to Gmail to actually clear it. A
curated list that can't be acted on just becomes a second copy of the inbox
to keep mentally dismissing.

**Decision** — Two actions per message: **Trash** (with an arm/confirm
step, same pattern as task deletion) and **Move…** (a small popover listing
existing Gmail labels as one-click chips, plus free text to create a new
one). Both use `gmail.modify` — read, label, and trash, but never a
permanent, bypass-the-trash delete — rather than the much broader
`https://mail.google.com/` scope real permanent deletion would need.

**Reasoning** — In Gmail's own model there's no real distinction between
"delete" and "archive to a folder" the way older mail clients drew it —
Trash *is* a label, same as any other. Building both actions on the same
`modify` scope, as label add/remove calls, kept the permission footprint to
exactly what "get it out of the inbox view" requires, with Gmail's own
30-day Trash window standing in for undo rather than building one.

**Shipped-then-caught mistake** — The first pass hid both action buttons
behind `opacity: 0`, revealed only on hover (mirroring `.task__body`'s
hover-tint elsewhere in the app). Once actually reconnected and tested with
real mail, *I* couldn't find my own buttons — not a screen-reader or
keyboard-nav gap, just: nothing on screen hinted they existed at all. Fixed
by making them permanently visible, small pill buttons at rest. Worth
stating plainly: hover-reveal is fine for a secondary affordance next to an
already-visible primary one (a task's rename-on-click, an event's
click-to-expand); it's the wrong call for the *only* way to reach a
feature, since at that point "hover to discover" isn't discovery.

**Alternatives considered** — A confirm-free single-click trash with an
"Undo" toast — closer to some mail clients' muscle-memory, but would have
meant building real undo state rather than relying on Gmail's own Trash,
for a feature that's already one extra click away from irreversible.

**Tradeoffs / open questions** — The row now has two more small buttons
sitting in front of the note chip at all times — measurably busier than the
static reference's reply row, in exchange for the card actually being able
to do what its title promises.

---

## 2026-09-27 — Merge multiple shared calendars into one agenda (revised same day: curated list → auto-discover + opt-out)

**Problem / trigger** — The agenda only ever showed one calendar (the
account's own "primary"), even though other calendars — including ones
belonging to entirely different Google accounts — had been shared with it.
A shared-with-you calendar is real signal for "what does my day look like,"
and the card was silently dropping it.

**First decision (shipped, then reconsidered)** — An explicit,
comma-separated list of calendar addresses/ids to merge (opt-*in*),
reasoning that a curated agenda shouldn't inherit noise (declined events,
subscribed holiday calendars) just because it's technically visible via
`calendarList`, and that an explicit list keeps the agenda's contents 1:1
with a value you can read in `.env`, not indirectly tied to whatever
Google's own sidebar happens to have checked.

**Why it was reconsidered** — In practice, opt-in was cumbersome: every
newly-shared calendar needed a manual env-var edit before it would ever
show up, which is exactly backwards from how sharing normally works — you
find out a calendar exists *because* someone shared it, not because you
went looking for its address to add to a list. The friction I'd flagged as
a hypothetical "if this turns out to matter" tradeoff turned out to matter
immediately.

**Final decision** — Auto-discover via `calendarList` (every calendar the
account can see, down to `freeBusyReader` access) and merge all of them by
default, with an opt-*out* list (`GOOGLE_CALENDAR_EXCLUDE_IDS`) for
anything genuinely unwanted. This flips the default from "nothing extra
unless named" to "everything unless excluded" — matching how the person
actually experiences calendar sharing (additive, from Google's side) rather
than how the config file experiences it (additive, from a list you maintain).
Per-calendar fetch failures still don't blank the others (`Promise.allSettled`),
and event ids still get a per-calendar-index prefix, since Google's ids are
only unique within their own calendar.

**Alternatives considered** — Filtering auto-discovery to only calendars
marked `selected` in the user's own Google Calendar UI, as a proxy for "I
already said I want to see this." Not used: it silently depends on a Google
Calendar UI setting neither this app nor its config file ever shows the
value of, whereas an explicit exclude-list is visible and legible in
`.env` even though the include set (mostly) isn't.

**Tradeoffs / open questions** — The failure mode flips too: opt-in risked
missing calendars you'd want; opt-out risks *over-including* — a stray
subscribed calendar, a low-detail free/busy share — until you notice and
exclude it. Untimed (all-day) events are already filtered out upstream
(the existing `start.dateTime` check), which happens to keep most
holiday/birthday-style calendars from cluttering the timed agenda without
any special-casing for this feature.

---

## 2026-09-27 — Lock down the private deployment by default

**Problem / trigger** — After splitting the app into a private (live-data)
and public (demo) deployment, a live check showed the private deployment's
production URL was fully public — no login wall — serving real task and
calendar content to anyone with the link. `vercel project add` (creating a
project via CLI rather than importing through the dashboard) defaults its
deployment-protection scope to exclude the production alias, on the
assumption that a "production domain" is meant to be public. That's backwards
for a personal-data app, where production is the *one* deployment that must
not be public.

**Decision** — Turn on Vercel Authentication (SSO protection) scoped to
*all* deployment types, including the production alias, via a direct API
call once the CLI's own toggle proved insufficient (see below). Verified
empirically with `curl` against the actual URL, not just by trusting the
dashboard's reported state.

**Reasoning** — Free (password protection needs a paid plan we're not on),
and it fully closes the specific gap that mattered: the plain URL an
unauthenticated visitor would load. "It's probably fine" wasn't good enough
once real inbox/calendar content was on the line — the fix wasn't done until
an unauthenticated `curl` actually got redirected to Vercel's auth page.

**Alternatives considered** — Password protection (rejected: paid-plan
only). Leaving it on the CLI's default scope (`prod_deployment_urls_and_all_previews`,
which exempts the production alias) — rejected once testing showed it left
exactly the URL in question open.

**Tradeoffs / open questions** — Only I can view the private deployment now
(requires a Vercel login), which is the intended tradeoff. Worth re-checking
this setting any time the project is recreated or transferred, since it's a
default that fails open, not closed.

---

## 2026-09-26/27 — Split into a private (live) and public (demo) deployment

**Problem / trigger** — Wanted a version of the dashboard to point people at
(e.g. in a portfolio) without exposing personal task/calendar/email content,
while still having one codebase and one source of truth — a change made once
should reach both without a separate "publish to demo" step.

**Decision** — Same GitHub repo and branch, two separate Vercel projects with
different environment variables. The private one gets every real
integration secret; the public one gets none. Both auto-deploy from `main`.

**Reasoning** — The app already had the right shape for this: every
`/api/tasks*` write route checks `features.todoist`/`features.google` before
calling out, so a deployment with zero secrets fails closed (clean 400s,
never a real API call) rather than erroring in a way that could leak intent
or retry into a real account. Combined with the existing `isDemoMode` /
`DASHBOARD_FORCE_MOCK` fallback to the frozen reference dataset, "public
demo" turned out to require no new product logic at all — just a second
deployment with an empty environment. That's a strong argument, in
hindsight, for designing the mock-data fallback as a first-class path from
day one rather than an afterthought: it's what made the demo deployment
nearly free.

**Alternatives considered** — One deployment, two domains, with middleware
switching to demo mode by hostname. Rejected: it would mean the real secrets
live in the same running process that serves the public domain — a single
missed check away from leaking. Two deployments make the safe case the
*only* case for the public one: it has no secrets to leak, structurally.

**Tradeoffs / open questions** — Two projects to keep in sync on
non-secret settings (Node version, framework preset, etc.) — a small
maintenance surface traded for a much simpler security story.

---

## 2026-09-06 — "Sample" marker for stale-but-configured data sources

**Problem / trigger** — `dashboard-data.ts` already tracked, per card,
whether a slice's live fetch had failed and fallen back to mock data — but
nothing surfaced that to the viewer. A silently-stale Calendar/Gmail card is
indistinguishable from "nothing's on your calendar today," which is a
trust problem: the one thing this dashboard promises is that what's on
screen is real.

**Decision** — Extend the live/mock status to three states — `live`,
`mock` (configured, but the fetch is currently failing), `off` (nothing
configured for this slice) — and show a small "Sample" tag only in the
`mock` case. `off` stays silent, so demo mode (everything `off`) shows no
alarming tags at all.

**Reasoning** — The distinction that actually matters to a viewer isn't
"is this real," it's "did you mean for this to be real." An unconfigured
integration showing sample data is expected and fine; a configured
integration silently failing is the case worth flagging. Collapsing those
into one boolean (the original `live | mock`) couldn't make that
distinction.

**Alternatives considered** — A single global banner ("some data may be
stale") — rejected as less useful than per-card attribution, since a viewer
would still have no idea *which* card to distrust.

**Tradeoffs / open questions** — This shipped without ever being exercised
end-to-end in review — it happened to catch a real, pre-existing Google
OAuth failure (`invalid_grant`) the very first time the app ran after this
change landed, which was a nice unplanned validation of the design.

---

## 2026-09-06 — In-app settings panel, with URL query still taking precedence

**Problem / trigger** — Appearance/Density/Time were URL-query-only
(`?theme=dark&density=focused`) — functional, but there was no way to set a
preference from inside the app itself, and nothing persisted between visits.

**Decision** — A ⚙ trigger in the footer opens a small popover with three
segmented controls. Picking an option writes a `dashboard_prefs` cookie and
refreshes the server render. Precedence became URL query → cookie →
defaults, in that order — not cookie → URL, and not cookie only.

**Reasoning** — The URL-query behavior was worth keeping, not replacing:
being able to link the dashboard in a specific state (dark mode, for a
screenshot; 24-hour, for a specific audience) is a real, existing use case.
Making the cookie *win* over an explicit query param would have silently
broken every link anyone had already shared. Layering the cookie in as the
new *default* — below an explicit query param, above the hardcoded
defaults — added persistence without taking anything away.

**Alternatives considered** — A `localStorage`-based preference (client-only,
no cookie) — rejected because settings need to be known during server
rendering (the greeting, time formatting, and density filtering all happen
server-side), and `localStorage` isn't available there.

**Tradeoffs / open questions** — None outstanding; this is the kind of
precedence decision that's easy to get backwards without noticing for a
while, so it's worth a code comment as well as this entry.

---

## 2026-09-06 — Fixed: invisible text in system dark mode

**Problem / trigger** — A prior change made the dashboard follow the OS's
light/dark preference by default. Once live, the "shape of the day" note
(and a few other elements) rendered *legible-in-light, invisible-in-dark* —
near-black green text on a dark-green tint, well under 2:1 contrast.

**Decision** — Traced it to a mismatch between the component and the CSS's
own stated contract: the CSS's dark-mode overrides were written to apply
only when the theme element carried *no* `data-theme` attribute at all
(meaning "system"), but the component was unconditionally setting
`data-theme="system"` literally — so the selector never matched. Fixed by
omitting the attribute for the "system" case, matching what the CSS already
assumed.

**Reasoning** — The CSS file already documented its own contract in a
comment ("system... leaves it off"); the bug was the component not honoring
a rule that had already been written down. The safer fix was making the
component match the documented contract, rather than changing the CSS to
match the component's (arguably accidental) behavior — the CSS's approach
generalizes to more cases (any future "system"-like state) with less
special-casing.

**Alternatives considered** — Rewriting the CSS selectors to match on
`[data-theme="system"]` explicitly — would have worked, but every other
consumer of "no explicit theme" (there are several, including a portalled
popover component) would have needed the same explicit case added, whereas
fixing the two places that *set* the attribute was one change in two spots
versus N changes in the CSS.

**Tradeoffs / open questions** — A reminder that a design system's own
documented contract is worth grep-ing for before assuming a visual bug is a
missing style, rather than a broken assumption.
