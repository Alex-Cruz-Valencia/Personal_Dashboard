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

export interface DashboardSettings {
  theme: Theme;
  timeFormat: TimeFormat;
  density: Density;
}

export const DEFAULT_SETTINGS: DashboardSettings = {
  theme: "system",
  timeFormat: "12-hour",
  density: "comfortable",
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

export function parseSettings(
  searchParams: SearchParams,
  stored?: Partial<DashboardSettings>,
): DashboardSettings {
  const base = { ...DEFAULT_SETTINGS, ...stored };
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
  return out;
}

export function use24Hour(settings: DashboardSettings): boolean {
  return settings.timeFormat === "24-hour";
}
