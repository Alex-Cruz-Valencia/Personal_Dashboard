@AGENTS.md

# Morning Dashboard — project notes

- The UI is a **verbatim reproduction** of the Claude Design source
  "Morning Dashboard v2.dc.html". Its stylesheet is ported as-is into
  `src/app/globals.css` and components use those exact class names. Do not
  restyle — if the design changes, re-port from the design project
  (`0e114d1c-17f4-4cf4-9af5-6e2d7e880dc0`).
- All times are **decimal hours in the viewer's local day** (9.5 = 9:30am).
- Location + timezone are resolved per-request by `src/lib/location.ts`
  (query → device cookie → env → default) and threaded into weather, tasks,
  calendar and the clock. The browser shares position via `LocationSync` →
  `POST /api/location`. The reverse-geocoded name fills `weather.place`.
- Client components (the reference is static, so these add interaction):
  `WeatherCard` (temperature-curve scrub); `TaskList` (checkbox completes,
  click a task → `TaskDetail` editor popover — priority/due/project/labels/
  deadline/duration/notes, auto-saves per field; `+ Add task`); `DayArc` +
  `CalendarAgenda` (click → `EventDetail` popover); `LocationSync`;
  `AutoRefresh` (60s `router.refresh()` while visible).
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
