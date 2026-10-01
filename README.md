# Morning Dashboard

A personal morning dashboard — weather, a day timeline, tasks, a plan for the
day's open time and unanswered mail at a glance, plus a one-line "shape of
the day" note. Next.js (App Router) +
TypeScript + Tailwind v4.

The UI is a pixel-for-pixel reproduction of the Claude Design source
*"Morning Dashboard v2.dc.html"*. The design's stylesheet is ported verbatim
into [`src/app/globals.css`](src/app/globals.css) — treat it as the visual
spec.

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. With no configuration it renders the reference
design with frozen mock data (**demo mode**).

## How data flows

Every card renders from the typed model in [`src/lib/types.ts`](src/lib/types.ts).
[`src/lib/dashboard-data.ts`](src/lib/dashboard-data.ts) assembles one
`DashboardData` from whatever sources are configured and falls back to the
frozen mock ([`src/lib/mock-data.ts`](src/lib/mock-data.ts)) per slice — so a
component never knows whether a value is live or mock.

| Component | File | Data |
|---|---|---|
| `HelloCard` | greeting + date + shape-of-day note | clock + Phase 5 |
| `WeatherCard` | place, temp, condition, hourly temperature curve | Phase 2 |
| `DayArc` | the signature timeline | calendar |
| `TaskList` | today's tasks | Phase 3 |
| `PlanCard` | countdown to the next event + today's open time, filled with tasks that fit (Block → calendar) | Phase 3 + 4 |
| `EmailList` | needs a reply | Phase 4 |
| `Footline` | free-time + refreshed-at | clock + agenda |

Presentation knobs (`theme`, `surface`, `noteStyle`, `windDown`, `timeFormat`, `density`, plus `dayStart`/
`dayEnd`/`weatherStart` below) are set from the **⚙ panel in the footer**
(persisted in the `dashboard_prefs` cookie) or from the URL:
`/?theme=dark&density=focused&timeFormat=24-hour&dayStart=8&dayEnd=24`. A URL
param wins over the cookie, which wins over `DASHBOARD_ARC_FROM`/`ARC_TO`
(this deployment's own env-configured default), which wins over a final
hardcoded fallback. `theme` defaults to `system` — it follows the viewer's OS
light/dark setting via `prefers-color-scheme` — and `light`/`dark` force one
regardless of the OS. `noteStyle` (`timely` · `gentle` · `plain`) picks the
voice of the shape-of-the-day note. `windDown` (hour, default `21`;
`24` = never) is when the dashboard stops pointing at work: the note just
suggests winding down, and the Plan card stops suggesting tasks (before it,
free time only counts up to wind-down). `surface` defaults to `glass` (frosted translucent
cards over a soft ambient backdrop); `solid` gives the reference's opaque
cards, and the OS's reduce-transparency / increase-contrast settings force
solid automatically.

**Day / weather window.** `dayStart`/`dayEnd` move the day arc's visible
span (`dayEnd` can go up to `24` for midnight — the arc's scale stays
linear, so it's the literal value `24`, not `0`). `weatherStart` is
independent of `dayStart` — the weather card's hourly curve can start later
than the arc itself (early-morning weather is rarely worth showing even
when the arc starts early); it always shares the arc's end.

Cards that render from a **configured** source show a small "Sample" marker
when that source is failing and they've fallen back to mock data; a source
that simply isn't set up stays unmarked. Empty tasks / agenda / mail show a
one-line empty state. These three, plus the ⚙ panel, are the only additions
beyond the verbatim reference.

`AutoRefresh` re-renders the page every 60s while the tab is visible (and on
tab re-focus), so the clock, weather, tasks and agenda stay current without a
manual reload.

## Integration phases

Copy [`.env.example`](.env.example) to `.env.local` and fill in a phase to turn
it on. Each is independent; the rest stay on mock data.

### Phase 1 — UI shell (done)
Nothing to configure.

### Phase 2 — Weather (Open-Meteo, no API key)
Set `DASHBOARD_WEATHER_ENABLED="true"` (or configure any other phase — weather
then goes live automatically). Source:
[`src/lib/weather/open-meteo.ts`](src/lib/weather/open-meteo.ts).

The card shows the resolved place, current temp + condition, and an
interactive hourly temperature curve (hover / drag to scrub — the readout
names the calendar block each hour falls in).

**Location follows the device.** On first load the browser asks to share your
position (`LocationSync` → `POST /api/location` → an httpOnly cookie, rounded
to ~1 km); weather, the clock, the greeting and every event/task time then key
off wherever you are. Resolution order: `?lat=&lon=&tz=` query → device cookie
→ `DASHBOARD_LATITUDE`/`LONGITUDE`/`TIMEZONE` → San Francisco. `DELETE
/api/location` forgets the stored position.

### Phase 3 — Todoist (personal API token)
`TODOIST_API_TOKEN` — from Todoist → Settings → Integrations → Developer.
Optional `TODOIST_FILTER` (default `(today | overdue)`).
Source: [`src/lib/tasks/todoist.ts`](src/lib/tasks/todoist.ts).

**Full task management from the dashboard.** Click the checkbox to complete a
task; click the task to open an editor popover with rename, priority, due-date
quick chips + free-text ("fri 3pm"), postpone, **move to another project**,
labels, deadline, planned duration, notes, and delete. A **+ Add task** row
creates new tasks. Every change auto-saves. The personal token already has
full account access — no extra scope needed.

### Phase 4 — Google Calendar (read-only) + Gmail (read + label/trash)
1. Google Cloud console → create an **OAuth client ID** (Web application).
2. Enable the **Google Calendar API** and **Gmail API**.
3. Add redirect URI `http://localhost:3000/api/auth/google/callback`.
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. Add your Google address as a **test user** on the OAuth consent screen.
6. Visit `/api/auth/google` once to grant access. Tokens are cached
   server-side — in `.data/google-tokens.json` (gitignored) by default, or in
   Redis when `UPSTASH_REDIS_REST_URL`/`_TOKEN` (or `KV_REST_API_URL`/`_TOKEN`
   — what the Vercel Marketplace Upstash integration actually injects) are
   set (required on a serverless host — see [Deploying](#deploying)).
   Disconnect at `/api/auth/google/logout`.

**Multiple calendars.** The agenda auto-discovers and merges *every*
calendar this account can see — your own plus any calendar someone else has
shared with it, even from a different Google account. `calendar.readonly`
already covers anything shared with you, so no extra consent is needed.
Leave one out with `GOOGLE_CALENDAR_EXCLUDE_IDS` (comma-separated
addresses/ids). One calendar failing (revoked access) doesn't blank the
others — it's dropped and logged, and what's still reachable renders
normally.

**Plan card.** Replaces the old agenda list (the day arc already shows the
schedule). A name-free countdown ring to the next event, then today's open
gaps (≥20 min, from now until `dayEnd`), each with up to three Todoist tasks
that fit — by priority, deadline and duration (30 min when unset). **Block**
creates a calendar event at the start of the gap (now, for the current one)
and tags it with the task id; it never touches the Todoist task. Blocked tasks
move to **Scheduled**, where **Unblock** deletes just the event. Logic:
[`src/lib/plan.ts`](src/lib/plan.ts).

**Editing an event.** Click a block in the day arc to
rename, reschedule (date + start/end time), edit the location, or edit the
description — every field auto-saves — and to delete it, with a
confirm step. This needs the `calendar.events` scope (view/edit events on
every calendar, not calendar-management/sharing) in addition to
`calendar.readonly`; reconnect (`/api/auth/google/logout` →
`/api/auth/google`) if you connected before this scope was added. Deleting
or rescheduling only ever touches the single occurrence you clicked — a
recurring event's other instances are untouched, the same as Google
Calendar's own default "This event" behavior. Guests, notifications, and
recurrence itself aren't editable here — **Open in Calendar** on the same
card jumps to the real event for anything not covered.

**Needs a reply** curates the inbox rather than showing raw unread (bot
senders like `vercel[bot]` are always dropped): it keeps
unread, important, and genuine threads (a shared doc, a recruiter, an
"action required", a real person — read *or* unread, since people reply
later) and drops promotions, social and bulk newsletters. Override the search
with `GMAIL_QUERY`.

**Clearing a message from the card.** Each reply has **Trash** (moves it to
Gmail's Trash — recoverable there for 30 days, same as clicking the trash
icon in Gmail) and **Move…** (apply a label and pull it out of the inbox —
picks from your existing labels, shown in Gmail's own colors, or type a new
one to create it). This needs the broader `gmail.modify` scope rather than
`gmail.readonly` — it can read, label, and trash, but never a permanent,
bypass-the-trash delete (that needs the much wider `mail.google.com` scope,
which this app deliberately doesn't request). If you connected Google before
this scope changed, disconnect and reconnect (`/api/auth/google/logout` →
`/api/auth/google`) to re-consent. Both actions clear the row from the card
immediately — they don't wait on the page-wide refresh that follows to
reconcile the count.

Sources: [`src/lib/google/`](src/lib/google/).

### Phase 5 — Daily summary (Anthropic API)
`ANTHROPIC_API_KEY`. Model defaults to `claude-opus-5`; override with
`ANTHROPIC_MODEL` (e.g. `claude-haiku-4-5` — plenty for a one-liner and much
cheaper). Without a key, a deterministic sentence is used instead.
Route: `GET|POST /api/summary`. Source:
[`src/lib/anthropic/summary.ts`](src/lib/anthropic/summary.ts).

## Endpoints

| Route | Purpose |
|---|---|
| `GET /api/status` | which integrations are configured / connected |
| `GET/POST/DELETE /api/location` | read / set / clear the device location |
| `GET /api/tasks/meta` | projects + labels for the editor |
| `POST /api/tasks` | create `{ content, projectId?, priority? (1–3), due?, labels? }` |
| `POST /api/tasks/[id]/complete` · `.../reopen` | mark done / undo |
| `PATCH /api/tasks/[id]` | edit `{ content?, priority? (1–3), due? (text / null), labels?, description?, deadline? (ISO / null), durationMinutes? (number / null), projectId? (move) }` |
| `DELETE /api/tasks/[id]` | delete a task |
| `GET /api/summary` | regenerate the day note from live data |
| `POST /api/summary` | day note from an explicit `{ nowHour, weather, tasks, agenda, style?, dayEnd? }` body |
| `POST /api/events` | create `{ name, date, startTime, endTime, taskId? }` on the primary calendar (Plan → Block) |
| `GET /api/auth/google` | start Google OAuth |
| `GET /api/auth/google/callback` | OAuth redirect target |
| `GET /api/auth/google/logout` | clear stored Google tokens |

## Scripts

```bash
npm run dev     # dev server
npm run build   # production build
npm run lint    # eslint
npx tsc --noEmit  # typecheck
```

## Deploying

This card shows real task names, calendar events and email subjects — treat
the live deployment like a password-protected personal page, not a public
site. The recommended setup is **two Vercel projects from the same GitHub
repo**, so every push updates both and neither has to be built or maintained
separately:

| | **Private** (you) | **Public demo** (anyone) |
|---|---|---|
| Env vars | All of them — `TODOIST_API_TOKEN`, `GOOGLE_CLIENT_ID`/`_SECRET`, `GOOGLE_REDIRECT_URI` (this deployment's own URL), `ANTHROPIC_API_KEY`, `DASHBOARD_*`, `UPSTASH_REDIS_REST_URL`/`_TOKEN` (or `KV_REST_API_URL`/`_TOKEN`) | **None of the above** — leave every integration var unset (or set `DASHBOARD_FORCE_MOCK="true"` to force it explicitly) |
| Behavior | Live data (see Integration phases above) | Frozen reference dataset — `isDemoMode` in `src/lib/config.ts`, `mock-data.ts` |
| Access | **Vercel → Project → Settings → Deployment Protection** — turn on Vercel Authentication or a password. Don't skip this; it's the only thing standing between the internet and your inbox. | Public, no protection needed |

Setup:

1. **Vercel → Add New Project**, import this repo, name it e.g.
   `morning-dashboard` (private). Add its env vars, set `DASHBOARD_BASE_URL`
   and `GOOGLE_REDIRECT_URI` to its real `https://…vercel.app` (or custom)
   domain, and turn on Deployment Protection — **Vercel Authentication is
   free and enough** (password protection needs a paid plan). One catch:
   its default scope (`vercel project protection enable <name> --sso`, or
   the dashboard equivalent) excludes your *production* domain/alias by
   default, protecting only preview deployments — widen it in the dashboard
   dropdown to include Production too, or the URL you actually visit stays
   open.
2. **Add a second project** from the *same* repo, name it e.g.
   `morning-dashboard-demo`. Add no integration env vars at all. Leave
   protection off.
3. Every `git push` to the branch both projects track redeploys both —
   there's no separate "publish to demo" step.
4. **Google token storage on a serverless host:** the private project's
   filesystem doesn't persist between invocations, so the default
   `.data/google-tokens.json` file store won't hold a connection. Add Redis
   from the **Vercel Marketplace** (Storage tab, or `vercel integration add
   upstash/upstash-kv`) to the *private* project only — it auto-injects
   `KV_REST_API_URL`/`KV_REST_API_TOKEN`, and `src/lib/google/tokens.ts`
   switches to it the moment those vars (or the `UPSTASH_REDIS_REST_*` pair,
   if you provision Upstash directly instead) exist. No code changes needed.
   Skip this if you're instead hosting on something with a real disk (Railway,
   Fly.io, Render, a VPS, a home server) — the file store just works there.
5. Visit `/api/auth/google` on the **private** deployment once, after
   Redis is wired up, to (re)connect.
