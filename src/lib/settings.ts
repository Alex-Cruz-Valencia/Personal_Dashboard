/**
 * Presentation settings — the three knobs the Claude Design component exposed
 * (Appearance / Behavior). They are read from the URL query so the dashboard
 * can be linked in any state, e.g. `/?theme=dark&density=focused`.
 */

export type Theme = "light" | "dark";
export type TimeFormat = "12-hour" | "24-hour";
export type Density = "comfortable" | "focused";

export interface DashboardSettings {
  theme: Theme;
  timeFormat: TimeFormat;
  density: Density;
}

export const DEFAULT_SETTINGS: DashboardSettings = {
  theme: "light",
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

export function parseSettings(searchParams: SearchParams): DashboardSettings {
  return {
    theme: pick(searchParams.theme, ["light", "dark"], DEFAULT_SETTINGS.theme),
    timeFormat: pick(
      searchParams.timeFormat ?? searchParams.time,
      ["12-hour", "24-hour"],
      DEFAULT_SETTINGS.timeFormat,
    ),
    density: pick(
      searchParams.density,
      ["comfortable", "focused"],
      DEFAULT_SETTINGS.density,
    ),
  };
}

export function use24Hour(settings: DashboardSettings): boolean {
  return settings.timeFormat === "24-hour";
}
