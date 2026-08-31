/**
 * Assembles one `DashboardData` from whatever sources are configured, falling
 * back to the frozen mock per-slice. Components never see the difference.
 */

import "server-only";
import { getDaySummary } from "./anthropic/summary";
import { config, features, forceMock, isDemoMode } from "./config";
import { deterministicDayNote } from "./day-note";
import { getAgenda } from "./google/calendar";
import { getReplies } from "./google/gmail";
import {
  MOCK_AGENDA,
  MOCK_ARC,
  MOCK_DAY_NOTE,
  MOCK_REPLIES,
  MOCK_TASKS,
  MOCK_TODAY,
  MOCK_USER,
  MOCK_WEATHER,
} from "./mock-data";
import { getTasks } from "./tasks/todoist";
import { decimalHourInZone, isoDateInZone } from "./time";
import type { DashboardData, SourceStatus, TodayInfo } from "./types";
import { getWeather } from "./weather/open-meteo";

async function settle<T>(
  label: string,
  run: () => Promise<T>,
  fallback: T,
): Promise<{ value: T; live: boolean }> {
  try {
    return { value: await run(), live: true };
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[dashboard] ${label} → mock:`, (err as Error).message);
    }
    return { value: fallback, live: false };
  }
}

function realToday(): TodayInfo {
  const now = new Date();
  return {
    iso: isoDateInZone(now, config.timezone),
    nowHour: decimalHourInZone(now, config.timezone),
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const arc = { from: config.arcFrom, to: config.arcTo };

  // Pure reference-reproduction mode: nothing configured, or explicitly forced.
  if (forceMock || isDemoMode) {
    return {
      user: MOCK_USER,
      today: MOCK_TODAY,
      weather: MOCK_WEATHER,
      dayNote: MOCK_DAY_NOTE,
      tasks: MOCK_TASKS,
      agenda: MOCK_AGENDA,
      replies: MOCK_REPLIES,
      arc: MOCK_ARC,
      sources: {
        weather: "mock",
        tasks: "mock",
        calendar: "mock",
        email: "mock",
        summary: "mock",
      },
    };
  }

  const today = realToday();
  const user = { name: config.userName ?? MOCK_USER.name };

  const [weather, tasks, agenda, replies] = await Promise.all([
    features.weather
      ? settle("weather", getWeather, MOCK_WEATHER)
      : Promise.resolve({ value: MOCK_WEATHER, live: false }),
    features.todoist
      ? settle("todoist", () => getTasks(today.iso), MOCK_TASKS)
      : Promise.resolve({ value: MOCK_TASKS, live: false }),
    features.google
      ? settle("calendar", () => getAgenda(today.iso), MOCK_AGENDA)
      : Promise.resolve({ value: MOCK_AGENDA, live: false }),
    features.google
      ? settle("gmail", getReplies, MOCK_REPLIES)
      : Promise.resolve({ value: MOCK_REPLIES, live: false }),
  ]);

  const summary = features.anthropic
    ? await settle(
        "summary",
        () =>
          getDaySummary({
            userName: user.name,
            nowHour: today.nowHour,
            weather: weather.value,
            tasks: tasks.value,
            agenda: agenda.value,
          }),
        deterministicDayNote(today.nowHour, tasks.value, agenda.value),
      )
    : {
        value: deterministicDayNote(today.nowHour, tasks.value, agenda.value),
        live: false,
      };

  const sources: SourceStatus = {
    weather: weather.live ? "live" : "mock",
    tasks: tasks.live ? "live" : "mock",
    calendar: agenda.live ? "live" : "mock",
    email: replies.live ? "live" : "mock",
    summary: summary.live ? "live" : "mock",
  };

  return {
    user,
    today,
    weather: weather.value,
    dayNote: summary.value,
    tasks: tasks.value,
    agenda: agenda.value,
    replies: replies.value,
    arc,
    sources,
  };
}
