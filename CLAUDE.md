@AGENTS.md

# Morning Dashboard — project notes

- The UI is a **verbatim reproduction** of the Claude Design source
  "Morning Dashboard v2.dc.html". Its stylesheet is ported as-is into
  `src/app/globals.css` and components use those exact class names. Do not
  restyle — if the design changes, re-port from the design project
  (`0e114d1c-17f4-4cf4-9af5-6e2d7e880dc0`).
- All times are **decimal hours in the viewer's local day** (9.5 = 9:30am).
- Cards render only from `src/lib/types.ts`. New data sources map into those
  shapes in `src/lib/dashboard-data.ts`; never hardcode into components.
- `src/lib/format.ts` is a line-by-line port of the design's `renderVals()` —
  keep parity with it.
- Nothing configured → demo mode (frozen `mock-data.ts`, exact reference).
