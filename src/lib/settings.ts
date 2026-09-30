/**
 * Presentation settings — the three knobs the Claude Design component exposed
 * (Appearance / Behavior).
 *
 * Precedence: URL query (`/?theme=dark&density=focused`, still linkable in any
 * state) → the `dashboard_prefs` cookie the in-app panel writes → defaults.
 */

/** Cookie the SettingsPanel writes; read back in `page.tsx`. */
export const PREFS_COOKIE = "dashboard_prefs";

/** "system" follows the viewer's OS light/dark preference; the rest force it. */
export type Theme = "light" | "dark" | "system";
export type TimeFormat = "12-hour" | "24-hour";
export type Density = "comfortable" | "focused";
/** "glass" = translucent frosted cards over an ambient backdrop; "solid" = the reference's opaque cards. */
export type Surface = "glass" | "solid";

export interface DashboardSettings {
  theme: Theme;
  timeFormat: TimeFormat;
  density: Density;
  surface: Surface;
  /** Visible span of the day arc, in whole local hours. 24 = midnight (end of day). */
  dayStart: number;
  dayEnd: number;
  /**
   * Where the weather card's hourly curve starts — independent of the day
   * arc (early-morning weather is rarely worth showing even when the arc
   * itself starts early). Always ends at `dayEnd`.
   */
  weatherStart: number;
}

/**
 * Generic fallback only — `page.tsx` layers `config.arcFrom`/`arcTo` in
 * ahead of these via `parseSettings`'s `stored` argument, so these three
 * rarely apply in practice (see the `weatherStart` note there too).
 */
export const DEFAULT_SETTINGS: DashboardSettings = {
  theme: "system",
  timeFormat: "12-hour",
  density: "comfortable",
  surface: "glass",
  dayStart: 6,
  dayEnd: 22,
  weatherStart: 6,
};

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
  // rather than let a malformed pair through.
  const [safeStart, safeEnd] =
    dayEnd - dayStart >= 1 ? [dayStart, dayEnd] : [base.dayStart, base.dayEnd];

  return {
    theme: pick(searchParams.theme, ["light", "dark", "system"], base.theme),
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
    dayStart: safeStart,
    dayEnd: safeEnd,
    weatherStart: Math.min(
      pickHour(searchParams.weatherStart, base.weatherStart),
      safeEnd - 1,
    ),
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
  if (obj.theme === "light" || obj.theme === "dark" || obj.theme === "system") {
    out.theme = obj.theme;
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
  if (typeof obj.dayStart === "number" && obj.dayStart >= 0 && obj.dayStart <= 24) {
    out.dayStart = obj.dayStart;
  }
  if (typeof obj.dayEnd === "number" && obj.dayEnd >= 0 && obj.dayEnd <= 24) {
    out.dayEnd = obj.dayEnd;
  }
  if (typeof obj.weatherStart === "number" && obj.weatherStart >= 0 && obj.weatherStart <= 24) {
    out.weatherStart = obj.weatherStart;
  }
  return out;
}

export function use24Hour(settings: DashboardSettings): boolean {
  return settings.timeFormat === "24-hour";
}
