/**
 * Central place for reading environment configuration and deciding which
 * integrations are wired up. Nothing here throws — a missing value just means
 * that slice falls back to mock data.
 */

import "server-only";

function str(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

function num(name: string): number | undefined {
  const v = str(name);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export const config = {
  /** Shown in the greeting; falls back to the mock name. */
  userName: str("DASHBOARD_USER_NAME"),

  /** IANA timezone for "now", sunrise/sunset, event times. */
  timezone: str("DASHBOARD_TIMEZONE") ?? "America/Los_Angeles",

  /** Location for weather + daylight. Defaults to San Francisco. */
  latitude: num("DASHBOARD_LATITUDE") ?? 37.7749,
  longitude: num("DASHBOARD_LONGITUDE") ?? -122.4194,

  /** The visible span of the day arc, in whole local hours. */
  arcFrom: num("DASHBOARD_ARC_FROM") ?? 6,
  arcTo: num("DASHBOARD_ARC_TO") ?? 22,

  weather: {
    /**
     * Open-Meteo needs no key. It goes live automatically once any other
     * integration is configured, or immediately when this is set to "true".
     * Set to "false" to force the mock even then.
     */
    setting: str("DASHBOARD_WEATHER_ENABLED"),
  },

  todoist: {
    token: str("TODOIST_API_TOKEN"),
    /** Todoist filter query for "today's tasks". */
    filter: str("TODOIST_FILTER") ?? "(today | overdue)",
  },

  google: {
    clientId: str("GOOGLE_CLIENT_ID"),
    clientSecret: str("GOOGLE_CLIENT_SECRET"),
    /** Must exactly match an authorized redirect URI in the Google console. */
    redirectUri:
      str("GOOGLE_REDIRECT_URI") ??
      `${str("DASHBOARD_BASE_URL") ?? "http://localhost:3000"}/api/auth/google/callback`,
    calendarId: str("GOOGLE_CALENDAR_ID") ?? "primary",
    /**
     * Gmail search for the "needs a reply" list. `category:primary` keeps it to
     * the Primary tab, which already excludes Promotions / Social / Updates /
     * Forums. Bulk mail that still slips through is dropped in `gmail.ts` by
     * its List-Unsubscribe header.
     */
    gmailQuery:
      str("GMAIL_QUERY") ??
      "in:inbox is:unread category:primary -from:me newer_than:7d",
  },

  anthropic: {
    apiKey: str("ANTHROPIC_API_KEY"),
    model: str("ANTHROPIC_MODEL") ?? "claude-opus-5",
  },
} as const;

const todoist = Boolean(config.todoist.token);
const google = Boolean(config.google.clientId && config.google.clientSecret);
const anthropic = Boolean(config.anthropic.apiKey);

/** True when nothing at all is configured — pure reference-reproduction mode. */
export const isDemoMode =
  !todoist && !google && !anthropic && config.weather.setting !== "true";

/** Force the frozen mock dataset even when integrations exist (for pixel checks). */
export const forceMock = process.env.DASHBOARD_FORCE_MOCK === "true";

export const features = {
  weather:
    !forceMock &&
    config.weather.setting !== "false" &&
    (config.weather.setting === "true" || todoist || google || anthropic),
  todoist: !forceMock && todoist,
  google: !forceMock && google,
  anthropic: !forceMock && anthropic,
} as const;
