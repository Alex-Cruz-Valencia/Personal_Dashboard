/**
 * Presentation settings — the three knobs the Claude Design component exposed
 * (Appearance / Behavior).
 *
 * Precedence: URL query (`/?theme=dark&density=focused`, still linkable in any
 * state) → the `dashboard_prefs` cookie the in-app panel writes → defaults.
 */

/** Cookie the SettingsPanel writes; read back in `page.tsx`. */
export const PREFS_COOKIE = "dashboard_prefs";

/** What the page renders: "system" follows the viewer's OS light/dark preference; the rest force it. */
export type Theme = "light" | "dark" | "system";
/**
 * What the viewer picks. "timed" follows the sun: light from sunrise, dark from
 * sunset — resolve it with `shownTheme()` before rendering.
 */
export type ThemeChoice = Theme | "timed";
export type TimeFormat = "12-hour" | "24-hour";
export type Density = "comfortable" | "focused";
/** "glass" = translucent frosted cards over an ambient backdrop; "solid" = the reference's opaque cards. */
export type Surface = "glass" | "solid";
/** Ambient animation (weather scene, live clock motion). "off" is fully still. */
export type Motion = "on" | "off";
/** The weather scene (stars, sun, rain, clouds) across the whole page behind frosted cards, or none. Needs Motion on. */
export type Background = "scene" | "plain";
/** "hide": the calendar tucks away anything more than about an hour past (scroll up or tap to see it); "show": the whole day stays. */
export type PastEvents = "hide" | "show";
/**
 * The top row: "unified" is one scenic card (greeting, clock, weather and its curve); "simple" is
 * that card without the curve (now, high/low, rain or wind); "brief" swaps the curve for a few
 * weather lines that change plans; "classic" is the greeting card beside the weather card.
 */
export type TopRow = "classic" | "unified" | "simple" | "brief";
/** The light theme's palette: "daylight" (off-white, sage) or "clay" (sand, terracotta). Dark is unaffected. */
export type LightPalette = "daylight" | "clay";
/** "cards" is the dashboard's own look; "clean" borrows Todoist's: flat rows, hairlines, sentence-case labels, quiet chrome. */
export type Look = "cards" | "clean";
/** The calendars' look: "dashboard" is the page's own; "google" copies Google Calendar's (solid blocks, cascade, "8 AM"). */
export type CalLook = "dashboard" | "google";
/** Voice of the "shape of the day" note — see src/lib/day-note.ts. */
export type NoteStyle = "timely" | "gentle" | "plain";

export interface DashboardSettings {
  theme: ThemeChoice;
  lightPalette: LightPalette;
  look: Look;
  calLook: CalLook;
  timeFormat: TimeFormat;
  density: Density;
  surface: Surface;
  motion: Motion;
  background: Background;
  pastEvents: PastEvents;
  topRow: TopRow;
  noteStyle: NoteStyle;
  /** Visible span of the day arc, in whole local hours. 24 = midnight (end of day). */
  dayStart: number;
  dayEnd: number;
  /**
   * Where the weather card's hourly curve starts — independent of the day
   * arc (early-morning weather is rarely worth showing even when the arc
   * itself starts early). Always ends at `dayEnd`.
   */
  weatherStart: number;
  /**
   * From this hour on, nothing points at work: the day note just suggests
   * winding down and the Plan card stops suggesting tasks. 24 = never.
   */
  windDown: number;
}

/**
 * Generic fallback only — `page.tsx` layers `config.arcFrom`/`arcTo` in
 * ahead of these via `parseSettings`'s `stored` argument, so these three
 * rarely apply in practice (see the `weatherStart` note there too).
 */
export const DEFAULT_SETTINGS: DashboardSettings = {
  theme: "system",
  lightPalette: "daylight",
  look: "cards",
  calLook: "dashboard",
  timeFormat: "12-hour",
  density: "comfortable",
  surface: "solid",
  motion: "on",
  background: "scene",
  pastEvents: "hide",
  topRow: "unified",
  noteStyle: "timely",
  dayStart: 6,
  dayEnd: 22,
  weatherStart: 6,
  windDown: 21,
};

/** Settings as rendered: the theme already resolved (see `shownTheme`). */
export type ShownSettings = Omit<DashboardSettings, "theme"> & { theme: Theme };

/** The theme to render right now: "timed" is light between sunrise and sunset (local decimal hours). */
export function shownTheme(theme: ThemeChoice, nowHour: number, sun: { sunrise: number; sunset: number }): Theme {
  if (theme !== "timed") return theme;
  return nowHour >= sun.sunrise && nowHour < sun.sunset ? "light" : "dark";
}

type SearchParams = Record<string, string | string[] | undefined>;

function pick<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  const v = Array.isArray(value) ? value[0] : value;
  return (allowed as readonly string[]).includes(v ?? "") ? (v as T) : fallback;
}

/** An hour-of-day, 0–24 inclusive (24 = midnight as end-of-day). */
function pickHour(value: string | string[] | undefined, fallback: number): number {
  const v = Array.isArray(value) ? value[0] : value;
  if (v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 24 ? n : fallback;
}

export function parseSettings(
  searchParams: SearchParams,
  stored?: Partial<DashboardSettings>,
): DashboardSettings {
  const base = { ...DEFAULT_SETTINGS, ...stored };

  const dayStart = pickHour(searchParams.dayStart, base.dayStart);
  const dayEnd = pickHour(searchParams.dayEnd, base.dayEnd);
  // A day that doesn't run forward at least an hour breaks the arc's math
  // (division by a ~zero span) — fall back to the last-known-good pair
  // rather than let a malformed pair through. The stored pair (cookie or env)
  // can be malformed too, so the defaults are the last resort.
  const valid = (s: number, e: number) => e - s >= 1;
  const [safeStart, safeEnd] = valid(dayStart, dayEnd)
    ? [dayStart, dayEnd]
    : valid(base.dayStart, base.dayEnd)
      ? [base.dayStart, base.dayEnd]
      : [DEFAULT_SETTINGS.dayStart, DEFAULT_SETTINGS.dayEnd];

  return {
    theme: pick(searchParams.theme, ["light", "dark", "system", "timed"], base.theme),
    lightPalette: pick(searchParams.palette, ["daylight", "clay"], base.lightPalette),
    look: pick(searchParams.look, ["cards", "clean"], base.look),
    calLook: pick(searchParams.cal, ["dashboard", "google"], base.calLook),
    timeFormat: pick(
      searchParams.timeFormat ?? searchParams.time,
      ["12-hour", "24-hour"],
      base.timeFormat,
    ),
    density: pick(
      searchParams.density,
      ["comfortable", "focused"],
      base.density,
    ),
    surface: pick(searchParams.surface, ["glass", "solid"], base.surface),
    motion: pick(searchParams.motion, ["on", "off"], base.motion),
    background: pick(searchParams.background, ["scene", "plain"], base.background),
    pastEvents: pick(searchParams.past, ["hide", "show"], base.pastEvents),
    topRow: pick(searchParams.top, ["classic", "unified", "simple", "brief"], base.topRow),
    noteStyle: pick(searchParams.noteStyle, ["timely", "gentle", "plain"], base.noteStyle),
    dayStart: safeStart,
    dayEnd: safeEnd,
    weatherStart: Math.min(
      pickHour(searchParams.weatherStart, base.weatherStart),
      safeEnd - 1,
    ),
    windDown: pickHour(searchParams.windDown, base.windDown),
  };
}

/** Parse the `dashboard_prefs` cookie value; unknown / malformed fields drop. */
export function readStoredSettings(raw: string | undefined): Partial<DashboardSettings> {
  if (!raw) return {};
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
  const out: Partial<DashboardSettings> = {};
  if (obj.theme === "light" || obj.theme === "dark" || obj.theme === "system" || obj.theme === "timed") {
    out.theme = obj.theme;
  }
  if (obj.lightPalette === "daylight" || obj.lightPalette === "clay") {
    out.lightPalette = obj.lightPalette;
  }
  if (obj.look === "cards" || obj.look === "clean") {
    out.look = obj.look;
  }
  if (obj.calLook === "dashboard" || obj.calLook === "google") {
    out.calLook = obj.calLook;
  }
  if (obj.timeFormat === "12-hour" || obj.timeFormat === "24-hour") {
    out.timeFormat = obj.timeFormat;
  }
  if (obj.density === "comfortable" || obj.density === "focused") {
    out.density = obj.density;
  }
  if (obj.surface === "glass" || obj.surface === "solid") {
    out.surface = obj.surface;
  }
  if (obj.motion === "on" || obj.motion === "off") {
    out.motion = obj.motion;
  }
  if (obj.background === "scene" || obj.background === "plain") {
    out.background = obj.background;
  }
  if (obj.pastEvents === "hide" || obj.pastEvents === "show") {
    out.pastEvents = obj.pastEvents;
  }
  if (obj.topRow === "classic" || obj.topRow === "unified" || obj.topRow === "simple" || obj.topRow === "brief") {
    out.topRow = obj.topRow;
  }
  if (obj.noteStyle === "timely" || obj.noteStyle === "gentle" || obj.noteStyle === "plain") {
    out.noteStyle = obj.noteStyle;
  }
  if (typeof obj.dayStart === "number" && obj.dayStart >= 0 && obj.dayStart <= 24) {
    out.dayStart = obj.dayStart;
  }
  if (typeof obj.dayEnd === "number" && obj.dayEnd >= 0 && obj.dayEnd <= 24) {
    out.dayEnd = obj.dayEnd;
  }
  if (typeof obj.weatherStart === "number" && obj.weatherStart >= 0 && obj.weatherStart <= 24) {
    out.weatherStart = obj.weatherStart;
  }
  if (typeof obj.windDown === "number" && obj.windDown >= 0 && obj.windDown <= 24) {
    out.windDown = obj.windDown;
  }
  return out;
}

export function use24Hour(settings: DashboardSettings): boolean {
  return settings.timeFormat === "24-hour";
}
