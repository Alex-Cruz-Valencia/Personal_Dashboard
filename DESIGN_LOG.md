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
Solid switch is the manual fallback.

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
