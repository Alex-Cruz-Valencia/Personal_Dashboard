# Morning Dashboard

A personal morning dashboard — weather, tasks, agenda and unanswered mail at a
glance, plus a one-line "shape of the day" note. Next.js (App Router) +
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
| `DayArc` | the signature timeline | agenda + tasks |
| `TaskList` | today's tasks | Phase 3 |
| `CalendarAgenda` | agenda | Phase 4 |
| `EmailList` | needs a reply | Phase 4 |
| `Footline` | free-time + refreshed-at | clock + agenda |

Presentation knobs (`theme`, `timeFormat`, `density`) come from the URL:
`/?theme=dark&density=focused&timeFormat=24-hour`.

## Integration phases

Copy [`.env.example`](.env.example) to `.env.local` and fill in a phase to turn
it on. Each is independent; the rest stay on mock data.

### Phase 1 — UI shell (done)
Nothing to configure.

### Phase 2 — Weather (Open-Meteo, no API key)
Set `DASHBOARD_WEATHER_ENABLED="true"` (or configure any other phase — weather
then goes live automatically). Source:
[`src/lib/weather/open-meteo.ts`](src/lib/weather/open-meteo.ts).

**Location follows the device.** On first load the browser asks to share your
position (`LocationSync` → `POST /api/location` → a cookie); weather, daylight,
the clock, the greeting and every event/task time then key off wherever you
are. Resolution order: `?lat=&lon=&tz=` query → device cookie →
`DASHBOARD_LATITUDE`/`LONGITUDE`/`TIMEZONE` → San Francisco. `DELETE
/api/location` forgets the device position.

### Phase 3 — Todoist (personal API token)
`TODOIST_API_TOKEN` — from Todoist → Settings → Integrations → Developer.
Optional `TODOIST_FILTER` (default `(today | overdue)`).
Source: [`src/lib/tasks/todoist.ts`](src/lib/tasks/todoist.ts).

### Phase 4 — Google Calendar + Gmail (OAuth2, read-only)
1. Google Cloud console → create an **OAuth client ID** (Web application).
2. Enable the **Google Calendar API** and **Gmail API**.
3. Add redirect URI `http://localhost:3000/api/auth/google/callback`.
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. Add your Google address as a **test user** on the OAuth consent screen.
6. Visit `/api/auth/google` once to grant access. Tokens are cached server-side
   in `.data/google-tokens.json` (gitignored). Disconnect at
   `/api/auth/google/logout`.

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
| `GET /api/summary` | regenerate the day note from live data |
| `POST /api/summary` | day note from an explicit `{ nowHour, weather, tasks, agenda }` body |
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
