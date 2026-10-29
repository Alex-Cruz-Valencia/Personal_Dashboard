@AGENTS.md

# Morning Dashboard — project notes

- **Design decisions get logged.** When a change is a design/product choice
  (not just an implementation detail) — a new UI pattern, a behavior
  tradeoff, a naming/copy call, a security or architecture decision with
  user-facing consequences — add an entry to [`DESIGN_LOG.md`](DESIGN_LOG.md)
  (problem, decision, reasoning, alternatives, tradeoffs). It's kept
  separate from code so it reads as a standalone product narrative. Routine
  bug fixes with no real alternative don't need an entry.

- The UI started as a reproduction of the Claude Design source
  "Morning Dashboard v2.dc.html" (project `0e114d1c-17f4-4cf4-9af5-6e2d7e880dc0`)
  and its class names and stylesheet structure are still the base in
  `src/app/globals.css`. **Since 2026-10-27 it deliberately departs from the
  reference** (see `DESIGN_LOG.md`): warm neutral tokens (canvas `#F4F1EA`, light
  and dark), 12/8/6px radii, no card shadow, a flat day-arc band, a global teal
  focus ring, and **Solid is the default surface** (Glass is opt-in under ⚙ →
  Surfaces). Function over polish: nothing decorative may push actionable content
  off the first screen. Don't "restore" the reference tokens.
- Additions **not** in the static reference, kept token-only (see the marked
  sections at the end of `globals.css`): the ⚙ `SettingsPanel`, per-card empty
  states (`.card__empty`), the `StaleTag` "Sample" marker, the day-arc overlap
  cascade (`.arc__event--stacked`; `layoutOverlaps()` in `format.ts`),
  narrow-block labels (`.arc__event--tight`; `placeSideLabel()`), the arc's
  "Expand" zoom (`.dayarc--expanded`, on by default; `expandedHourPx()`, drag-to-pan
  via `useDragPan`, remembered in localStorage), and the opt-in **glass surfaces**
  (`.morning--glass`, `settings.surface`; a layer at the end of `globals.css`
  driven by `--glass-*` tokens and `:root:has(.morning--glass)`; falls back to
  solid under `prefers-reduced-transparency` / `prefers-contrast: more`).
- **"What did I miss?" layer** (all pure logic is server/client-safe):
  - `AttentionStrip` (`src/lib/attention.ts`): conflicts, tight turnarounds (<10
    min), overdue tasks (one rolled-up line; `Task.overdueDays` is date-based, set
    in `todoist.ts`), replies. Reply items open `ReplyQueue` (Reply in Gmail,
    Wait a day, Move, Trash); other items scroll to their card.
  - Reply visibility is shared client state in `src/lib/reply-state.ts`
    (session-cleared + "Wait" snoozes in localStorage `dashboard_snoozed`, 24h);
    `EmailList`, the strip and the queue all filter by it. Snooze never touches Gmail.
  - Day arc: free-gap labels, red conflict marks, Now/Next readout
    (`freeSpans`/`conflictSpans`/`upNext` in `attention.ts`).
  - `WeekStrip` (`src/lib/week.ts`): today + 6 days, booked hours and tasks due
    (six extra `getAgenda` calls + one Todoist query, all fail-soft; `week` is
    null when neither source is live). "Heavy" = booked + 30 min/task ≥ 6h.
  - Focus timer (`Focus.tsx`): local only (localStorage `dashboard_focus`), start
    from the arc toolbar or a task's editor; shows in the arc header, as a block,
    and in the tab title. Writes nothing to Google or Todoist.
- **AI (any OpenAI-compatible chat API, e.g. Dartmouth Chat)** — `LLM_BASE_URL`,
  `LLM_API_KEY`, `LLM_MODEL` in gitignored `.env.local` (private deployment env
  only; **never** the public demo, never `NEXT_PUBLIC_`). `features.llm` +
  `features.google` gate it (`DashboardData.ai`). Rules for any new AI route:
  use `guardAi()` (`src/lib/llm/guard.ts`: fail closed, same-origin, hourly cap),
  call the model only through `src/lib/llm/client.ts` (no logging, generic
  errors, input cap), validate model output on the server, require a human click
  before any write, send the minimum data. Don't pass `temperature` (the model
  rejects it) and keep token budgets generous (they include hidden reasoning).
  Features: `POST /api/replies/[id]/draft` (+ `/save` → Gmail *draft*, never
  sends; `gmail.modify` already covers drafts) and `POST /api/plan/suggest`
  (validated by `schedule-validate.ts`; each suggestion needs its own Block).
  `npm run llm:models` lists model ids.
- **Top row (2026-10-30):** `settings.topRow` — "unified" (default, `TopUnified`: one
  scenic card with greeting, clock, a one-line weather summary and the day's temperature
  curve as a full-width band, sun/moon included) or "classic" (`HelloCard` + `WeatherCard`),
  switchable under ⚙ **Top row**. The curve is `TempCurve` (sizes "full" and "wide",
  `refined` = smooth curve, past dimmer than ahead). `?now=14.5` previews another hour.
- **Current page layout (2026-10-28):** header + weather, `AttentionStrip`, then
  `DayCalendar` (vertical, Google-Calendar-style day view: `HOUR_PX`, side-by-side
  overlap lanes from `layoutOverlaps()`, a now line, lands near now; owns the
  Now/Next readout and Focus timer controls) beside `TaskList` in `.twocol`, then
  `WeekStrip`. **Archived (kept in the repo, not rendered):** `DayArc` (the
  horizontal arc and its `.dayarc*` CSS), `PlanCard` (so "Plan with AI" has no UI;
  `/api/plan/suggest` still exists), and `EmailList` (replies are reachable only via
  the attention strip's `ReplyQueue` popover). The server still fetches mail and the
  week-ahead data. To bring one back, render it in `Dashboard.tsx`.
- **Changed from the reference:** the accent is teal (`--accent`
  #0B6F75 / #4DC3C4 dark, `--accent-tint`, and the note text) in every
  mode, instead of the source's green.
- **Day note** (`src/lib/day-note.ts`): three voices via `settings.noteStyle`
  (timely default / gentle / plain); the task name is wrapped `**…**` and
  `HelloCard` bolds it via `splitNote` (the AI prompt asks for the same
  marker); no quotes around names. From `settings.windDown` (default 21,
  ⚙ "Wind down at") the note is a fixed wind-down line (no AI call) and
  `PlanCard` hides suggestions; before it, free time is capped at wind-down.
  The calendar's "That's the day" scene (`EndOfDay`) also starts at this hour;
  with nothing left today it then replaces the hours entirely. The page-wide
  `WeatherScene` (variant "page") adds meteors on clear nights and drifting
  sunbeams on clear days; `MeteorField` cuts every `.card`/`.attn` out of the
  meteor layer (clip-path, re-measured on scroll/resize) so meteors vanish
  behind sections.
- **List rows**: tasks, replies and Plan suggestions share one row style
  (`--row-hover` / `--row-lift`, no divider lines, neutral hover — never a
  colored text change).
- **Removed from the reference:** the day arc's task-due ticks + legend
  entry (tasks aren't calendar events; they stay in the task card), and the
  agenda card (replaced by `PlanCard`).
- All times are **decimal hours in the viewer's local day** (9.5 = 9:30am).
- Location + timezone are resolved per-request by `src/lib/location.ts`
  (query → device cookie → env → default) and threaded into weather, tasks,
  calendar and the clock. The browser shares position via `LocationSync` →
  `POST /api/location`. The reverse-geocoded name fills `weather.place`.
- Client components (the reference is static, so these add interaction):
  `WeatherCard` (temperature-curve scrub); `TaskList` (checkbox completes,
  click a task → `TaskDetail` editor popover — priority/due/project/labels/
  deadline/duration/notes, auto-saves per field; `+ Add task`); `DayArc`
  (click → `EventDetail` popover); `PlanCard` (replaced the agenda list —
  countdown ring, open gaps filled by `buildPlan()` in `src/lib/plan.ts`,
  Block → `POST /api/events` tagged `[todoist:<id>]` in the description,
  Unblock → `DELETE /api/events/[id]`; never writes to Todoist);
  `LocationSync`;
  `AutoRefresh` (60s `router.refresh()` while visible); `SettingsPanel`
  (writes the `dashboard_prefs` cookie, then `router.refresh()`).
- **Theme "timed"** ("By time", 2026-10-29 experiment): light from `LIGHT_FROM`
  (5) to `settings.darkFrom` (default 12), dark otherwise. `settings.theme` is a
  `ThemeChoice`; `Dashboard` resolves it once with `shownTheme()` and passes
  `ShownSettings` (theme is plain light/dark/system) down — anything that sets
  `data-theme` must use the resolved theme, never the raw choice. Only
  `SettingsPanel` sees the raw choice.
- Settings precedence (`src/lib/settings.ts` → read in `page.tsx`): URL query
  → `dashboard_prefs` cookie → `DEFAULT_SETTINGS`. `dayStart`/`dayEnd`/
  `weatherStart` are the exception: `page.tsx` layers `config.arcFrom`/
  `arcTo` in as the *stored* fallback ahead of the cookie, so the real
  precedence for those three is query → cookie → env config →
  `DEFAULT_SETTINGS`'s own hardcoded 6/22/6.
- `dashboard-data.ts`'s `getDashboardData` takes a `DayWindow` (`dayStart`,
  `dayEnd`, `weatherStart`) built from resolved settings — `arc` and
  `weatherArc` on `DashboardData` are derived from it, `weatherArc` sharing
  `dayEnd` but with its own start. `WeatherCard`'s `arc` prop is always
  `data.weatherArc`, never the day arc. `formatHour` (`format.ts`) takes
  `h % 24` before computing am/pm — needed once `dayEnd` can legitimately
  be `24` (midnight), which used to collide with noon's "12:00pm" label.
- `dashboard-data.ts` marks each slice `live` / `mock` (configured but the
  fetch failed — `StaleTag` shows) / `off` (nothing configured — silent).
- `Popover` (`src/components/Popover.tsx`) is the shared portalled-card shell
  (anchored positioning + viewport clamp + outside-click/Esc close); it carries
  its own `data-theme` since it renders outside `.morning`. Both
  `EventDetail` and `TaskDetail` build on it; their `*Provider`s wrap the tree
  in `Dashboard`.
- Task writes go through `/api/tasks*`, which `revalidateTag("todoist")` on
  success. `/api/tasks/meta` lazily supplies the project + label lists.
- Cards render only from `src/lib/types.ts`. New data sources map into those
  shapes in `src/lib/dashboard-data.ts`; never hardcode into components.
- `src/lib/format.ts` (+ the curve math in `WeatherCard`) port the design's
  `renderVals()` — keep parity when the design changes.
- Nothing configured → demo mode (frozen `mock-data.ts`, exact reference).
  Every `/api/tasks*` write route checks `features.todoist`/`features.google`
  before calling out, so a deployment with no secrets fails closed (400) —
  this is what makes the public demo deployment safe. See README → Deploying.
- Google token storage (`src/lib/google/tokens.ts`) auto-picks its backend:
  Redis when `UPSTASH_REDIS_REST_URL`/`_TOKEN` **or** `KV_REST_API_URL`/
  `KV_REST_API_TOKEN` are set (required on serverless hosts — the local file
  store doesn't survive between invocations there; the latter pair is what
  `vercel integration add upstash/upstash-kv` actually injects, kept for
  compatibility with the old first-party Vercel KV naming), else the
  gitignored `.data/google-tokens.json` file.
- `getAgenda` (`src/lib/google/calendar.ts`) auto-discovers every calendar
  the account can see via `calendarList` (`discoverCalendarIds`, min access
  role `freeBusyReader`) — including one shared from another Google
  account, no extra OAuth scope needed — minus
  `config.google.calendarExcludeIds` (`GOOGLE_CALENDAR_EXCLUDE_IDS`,
  comma-separated). Events are fetched with `Promise.allSettled`, so one
  calendar failing doesn't blank the rest; ids are prefixed with their
  calendar's index since Google's event ids are only unique within a
  calendar.
- Every Gmail/Calendar call goes through `googleFetch` (`tokens.ts`), which
  attaches the token and, on a 401, refreshes once, persists and retries —
  never call Google with a hand-built `Authorization` header. The stored
  `expiresAt` isn't proof a token works: Google invalidated one early on
  2026-09-30 and the dashboard sat on sample mail until this existed.
- A dead Google connection (not connected / no refresh token / `invalid_grant`)
  throws `GoogleAuthError` (`oauth.ts`); `settle` in `dashboard-data.ts`
  surfaces it as `DashboardData.googleReconnect`, and `StaleTag`'s `reconnect`
  prop turns the "Sample" pill into a "Reconnect Google" link.
- **Every write route calls `rejectCrossSite(request)`** (`src/lib/request-guard.ts`)
  first — 403 for requests from another site (`localhost` has no login in front
  of it). Path ids are validated before they reach a URL (`validTaskId`,
  `validMessageId`; calendar event ids are `encodeURIComponent`-ed in
  `eventUrl`). Add both to any new write route. `guardAi` builds on the same check.
- External fetches carry `AbortSignal.timeout` (Google/Todoist 15s, Open-Meteo
  10s, geocode 4s) so a hung API can't hold the page render.
- Popover editors save fields on blur; `Popover` blurs the focused field before
  closing (outside click / Esc), and × buttons call `flushFocus()` first — keep
  that for any new editor, or an in-progress edit is dropped on close.
  Destructive actions (delete, complete) close the card only after the server
  says ok. `EventDetail` debounces reschedules (one PATCH once fields settle);
  events clipped to 00:00/24:00 (they span past today) can't be dragged or
  re-timed here.
- **Never send email.** Drafts only. `googleFetch` calls `assertNoSend`
  (`src/lib/google/no-send.ts`, which also blocks the `/upload/...send` form and
  any `/batch` request) and `scripts/check-no-send.mjs` runs before
  every build/lint; both refuse Gmail send endpoints. `gmail.modify` allows
  sending, so these are the real guarantee. Don't add a send path or weaken
  them (DESIGN_LOG → "Hard guardrail").
- Gmail scope is `gmail.modify`, not `gmail.readonly` — `EmailList`'s
  Trash/Move actions need it. `trashMessage`/`moveMessageToLabel`/
  `listGmailLabels` (`src/lib/google/gmail.ts`) back `/api/replies/[id]/
  trash`, `/api/replies/[id]/move`, `/api/replies/meta`. Both write routes
  `revalidateTag(GMAIL_TAG)` so the next render reflects the change — same
  convention as the Todoist write routes. Widening the scope means any
  already-connected token needs a fresh `/api/auth/google` consent; it
  won't pick up write access on its own.
- `EmailList` fetches `/api/replies/meta` (labels + Gmail's own colors) on
  mount into a module-level cache, not on first "Move…" click — the
  popover should never show its own loading state. Trash/Move filter the
  cleared reply out of the *client-rendered* list immediately; they don't
  wait for the `router.refresh()` they still trigger in the background to
  reconcile the count/server state.
- Calendar scope is `calendar.readonly` **+** `calendar.events` (event
  read/write; deliberately not the broader `calendar` scope, which also
  covers creating/deleting/sharing whole calendars). `AgendaEvent.id` is
  `<encodeURIComponent(calendarId)>:<eventId>` (`compositeId`/
  `parseCompositeId` in `calendar.ts`) — it used to be a positional
  `calendarIndex`, which broke the moment `discoverCalendarIds()` returned
  calendars in a different order between requests; the real calendar id is
  the only thing safe to persist across a render. `deleteEvent`/
  `updateEvent` operate on a single occurrence (the list call already used
  `singleEvents=true`), so a recurring event's other instances are
  untouched — no "this vs. all" chooser needed. `EventDetail`'s edit form
  (`eventedit__*` in globals.css, mirroring `taskedit__*`) covers name,
  date/start/end, location, description, and delete; guests, reminders and
  recurrence are deliberately not editable here — `event.htmlLink` ("Open
  in Calendar") is the escape hatch for those.
