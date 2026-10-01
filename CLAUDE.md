@AGENTS.md

# Morning Dashboard — project notes

- **Design decisions get logged.** When a change is a design/product choice
  (not just an implementation detail) — a new UI pattern, a behavior
  tradeoff, a naming/copy call, a security or architecture decision with
  user-facing consequences — add an entry to [`DESIGN_LOG.md`](DESIGN_LOG.md)
  (problem, decision, reasoning, alternatives, tradeoffs). It's kept
  separate from code so it reads as a standalone product narrative. Routine
  bug fixes with no real alternative don't need an entry.

- The UI is a **verbatim reproduction** of the Claude Design source
  "Morning Dashboard v2.dc.html". Its stylesheet is ported as-is into
  `src/app/globals.css` and components use those exact class names. Do not
  restyle — if the design changes, re-port from the design project
  (`0e114d1c-17f4-4cf4-9af5-6e2d7e880dc0`).
- Additions **not** in the static reference, kept visually minimal and
  token-only (see the marked sections at the end of `globals.css`): the ⚙
  `SettingsPanel` in the footer, per-card empty states (`.card__empty`), the
  `StaleTag` "Sample" marker, the day-arc overlap cascade
  (`.arc__event--stacked`; lanes from `layoutOverlaps()` in `format.ts`),
  narrow-block labels (container queries on `.arc__event--tight`; side label
  from `placeSideLabel()`), and the arc's "Expand" zoom (`.dayarc--expanded`, **on by default**;
  px/hour = max(`expandedHourPx()`, what fits the card), bigger bubbles with
  range + location, edge fades + mouse drag-to-pan via `useDragPan`,
  remembered in localStorage), and **glass surfaces** (`.morning--glass`,
  the default; `settings.surface` "glass" | "solid", ⚙ → Surfaces). Glass is
  a layer at the very end of `globals.css` driven by `--glass-*` tokens and
  `:root:has(.morning--glass)` (so body + portalled popovers follow); it
  never edits the reference rules (the day arc's band + event blocks get
  their own glass rules there too, via a per-kind `--ev-c`; glass also
  overrides `--cal-*` with a pastel Okabe–Ito triad — periwinkle / apricot
  / mint; Solid keeps the reference's), and falls back
  to solid under
  `prefers-reduced-transparency` / `prefers-contrast: more`.
- **Changed from the reference:** the accent is teal (`--accent`
  #0B6F75 / #4DC3C4 dark, `--accent-tint`, and the note text) in every
  mode, instead of the source's green.
- **Day note** (`src/lib/day-note.ts`): three voices via `settings.noteStyle`
  (timely default / gentle / plain); the task name is wrapped `**…**` and
  `HelloCard` bolds it via `splitNote` (the AI prompt asks for the same
  marker); no quotes around names.
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
