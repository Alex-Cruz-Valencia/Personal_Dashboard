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

## Health page

Use the calendar (**My day**) and heart (**Health**) icons in the narrow
left navigation to switch between the morning dashboard and `/health`.
Labels appear on hover or keyboard focus; Escape dismisses the label. The scenic header and ambient
clock stay on My day. Health shares its display settings, palettes, and
card/row styling, with a compact title and status-first layout. It provides:

- A rolling seven-day training view using Hevy when configured, with every
  logged set, warm-up label, rep count, weight, cardio metric and effort rating.
- A broad progression view with one matching-rep comparison per exercise,
  median percentage change, directional bars, and four- or twelve-week views.
  Comparison coverage is explicit; individual lift charts expand on demand.
- A clickable training activity map and visual overview: weekly session ring,
  strength-direction distribution, sleep bars, and today's energy dots.
- Manual sleep trends and a short list of follow-ups, each with source context.
  Only the unconfigured/public demo uses sample sleep and training data.
- A shared seven-day timeline aligning Hevy workouts, FatSecret protein,
  sleep and energy by local date. Browse twelve weeks and select a date for
  daily fuel, same-day workout details, and manual check-in context.
- Daily macro/meal views with optional user-set protein and calorie targets.
  FatSecret diary authorization is still pending; nutrition stays unknown rather
  than showing sample or zero intake. Targets are browser-local, with no default
  calorie/protein prescription and no personal nutrition records saved locally.
- A working daily check-in for energy, sleep, soreness, steps, water, and notes.
  Water uses tappable bottles (empty → half → full → empty), with a remembered bottle
  size in fluid ounces/mL; changing size preserves previously logged volume.
  Dashboard bottle taps save water immediately, independently of check-ins.
- Editable training, sleep, steps, and hydration targets; example targets are
  starting values, not personalized recommendations.
- Expandable earlier workouts, check-in history, and source/integration details.
  FatSecret application authentication is prepared; personal diary authorization
  is still required before nutrition data can be displayed.

Check-ins and targets are stored only in this browser under
`dashboard_health_v1`, with at most 90 dated check-ins retained. They do not
sync or go to the server, Hevy, or an AI service. Today's check-in can be
edited or deleted; clearing the site's browser storage removes all entries
and targets. A date change opens a fresh daily check-in in the dashboard's
resolved timezone.

### Prepare the Hevy connection

Hevy API access requires Hevy Pro. Generate a key in
[Hevy developer settings](https://hevy.com/settings?developer), then put it in
the gitignored `.env.local` file:

```dotenv
HEVY_API_KEY="your-key-here"
```

Keep the real key out of chat, source control, and `NEXT_PUBLIC_` variables.
Restart the dev server after saving it, then open
<http://localhost:3000/api/health/hevy>. A successful check returns
`connected: true` and the workout count. Missing keys, rejected keys, rate
limits and outages have distinct messages. `DASHBOARD_FORCE_MOCK=true`
disables Hevy calls even when a key is present.

The server-only client in `src/lib/hevy/client.ts` supports read-only,
explicitly paginated workout history, routines, exercise metadata and preferred
weight units. It uses a fixed Hevy origin, timeouts and no persistent caching;
credentials and upstream error bodies are never returned or logged. The
connection probe does not write to Hevy or return workout details.

With a key configured, `/health` uses your **real Hevy training data**. The
server adapter in `src/lib/hevy/data.ts` loads every history page (up to 100
pages / 1,000 workouts), checks completeness against the workout count, and
normalizes dates into the dashboard's timezone. It shares a five-minute
in-memory workout cache between requests, coalesces concurrent refreshes,
and reuses exercise metadata for up to an hour. Nothing writes to Hevy.

Strength charts compare the same exercise at the same rep count, exclude
warm-ups, use actual logged dates, and follow your Hevy kg/lb preference.
They do not estimate 1RM or treat increasing assistance as progress. Primary
muscle working-set totals and saved routines are available in expandable
sections. Workout details preserve different sets rather than multiplying
the first set across an exercise.

A genuine empty history stays empty. During an outage, a labeled previous
sync may be retained in memory for up to 24 hours; without a previous sync,
training shows unavailable rather than substituting samples. Rejected
credentials clear the cached training history. Optional exercise metadata
failures are labeled and leave the workout list usable. The next refresh
retries after a one-minute backoff.

Sleep, energy, soreness, steps and water remain manual check-in data, with
missing nights excluded from sleep averages. FatSecret personal diary access remains unconnected.
See the [official Hevy API docs](https://api.hevyapp.com/docs/).

For deployment, add `HEVY_API_KEY` only to the **private Vercel project** and
redeploy that project. Leave it unset on the public demo. Local `.env.local`
settings do not automatically transfer to Vercel.

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
regardless of the OS. `palette` (`daylight` · `clay`) picks the light theme's palette — Clean
daylight or Desert clay; dark is the same either way. `timed` ("Daylight") is
light from sunrise to sunset and dark otherwise, using the
day's sunrise/sunset for the viewer's location. `noteStyle` (`timely` · `gentle` · `plain`) picks the
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

### Phase 4 — Google Calendar (read + edit events) + Gmail (read + label/trash)
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
addresses/ids). Blocks take each event's Google color (else its calendar's),
shown in the dashboard's own shade; `GOOGLE_CALENDAR_COLORS`
(`"Personal=banana,Work=blueberry"`, by calendar id or legend name) overrides a
calendar's color on the dashboard only. One calendar failing (revoked access) doesn't blank the
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

**Expired sign-in.** If Google rejects the stored refresh token (revoked, or
expired after 7 days while the OAuth consent screen is in *Testing* — publish
the app to avoid that), the Plan and Needs-a-reply cards show a **Reconnect
Google** link instead of the plain "Sample" marker; it goes to
`/api/auth/google`.

Sources: [`src/lib/google/`](src/lib/google/).

### Phase 5 — Daily summary (Anthropic API)
`ANTHROPIC_API_KEY`. Model defaults to `claude-opus-5`; override with
`ANTHROPIC_MODEL` (e.g. `claude-haiku-4-5` — plenty for a one-liner and much
cheaper). Without a key, a deterministic sentence is used instead.
Route: `GET|POST /api/summary`. Source:
[`src/lib/anthropic/summary.ts`](src/lib/anthropic/summary.ts).

### Phase 6 — AI drafting and planning (any OpenAI-compatible API)
Optional. Set `LLM_BASE_URL` (e.g. `https://chat.dartmouth.edu/api`),
`LLM_API_KEY` and `LLM_MODEL` in `.env.local` (run `npm run llm:models` to list
the model ids your key can use). Needs Google connected. Adds **Draft reply**
(saved as a Gmail draft, never sent) to the reply popover and **Plan with AI** to
the Plan card (each suggestion needs its own Block click). The key is read only
on the server; set it **only on the private deployment**, never the public demo.
Routes: `POST /api/replies/[id]/draft`, `POST /api/replies/[id]/draft/save`,
`POST /api/plan/suggest`. Source: [`src/lib/llm/`](src/lib/llm/).

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
| `POST /api/summary` | day note from an explicit `{ nowHour, weather, tasks, agenda, style?, dayEnd?, windDown? }` body |
| `POST /api/events` | create `{ name, date, startTime, endTime, taskId? }` on the primary calendar |
| `PATCH /api/events/[id]` | edit `{ name?, location?, description? }`, or reschedule with `{ date, startTime, endTime }` together (`HH:MM`, 24-hour) |
| `DELETE /api/events/[id]` | delete one occurrence |
| `GET /api/replies/meta` | Gmail labels for "Move…" |
| `POST /api/replies/[id]/trash` · `.../move` | trash, or `{ label }` move out of the inbox |
| `GET /api/auth/google` | start Google OAuth |
| `GET /api/auth/google/callback` | OAuth redirect target |
| `GET /api/auth/google/logout` | clear stored Google tokens (works typed into the address bar, not from a link on another site) |

Every route that writes (`POST`/`PATCH`/`DELETE`, and the logout link) refuses
requests coming from another website with a 403 (`rejectCrossSite`,
[`src/lib/request-guard.ts`](src/lib/request-guard.ts)), so a page open in the
same browser can't act on a running dashboard. Ids in the path are validated
before they reach Todoist, Google or Gmail.

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
| Env vars | All of them — `TODOIST_API_TOKEN`, `GOOGLE_CLIENT_ID`/`_SECRET`, `GOOGLE_REDIRECT_URI` (this deployment's own URL), `ANTHROPIC_API_KEY`, `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`, `DASHBOARD_*`, `UPSTASH_REDIS_REST_URL`/`_TOKEN` (or `KV_REST_API_URL`/`_TOKEN`) | **None of the above** — leave every integration var unset (or set `DASHBOARD_FORCE_MOCK="true"` to force it explicitly) |
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

### FatSecret application connection

Set `FATSECRET_CLIENT_ID` and `FATSECRET_CLIENT_SECRET` in ignored `.env.local`.
Never use `NEXT_PUBLIC_` or commit actual values. `/api/health/fatsecret` checks
application authentication server-side and returns no token. Forced mock mode
disables calls. A successful check does **not** connect your existing food diary:
that requires separate OAuth 1.0 Consumer Key/Secret and user authorization.
The current app does not fetch personal FatSecret records. See the
[capability research and dashboard plan](docs/fatsecret-integration.md) for the
access distinction, next steps and proposed nutrition views.
