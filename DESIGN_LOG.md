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
