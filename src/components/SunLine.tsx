"use client";

import { formatHour } from "@/lib/format";
import type { TodayInfo } from "@/lib/types";
import { useNowSeconds } from "@/lib/use-now";

function span(hours: number): string {
  const m = Math.max(1, Math.round(hours * 60));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

/** Where the sun is: time to sunset by day, to sunrise by night. Nothing the calendar already says. */
export function SunLine({ today, sunrise, sunset, use24, frozen }: { today: TodayInfo; sunrise: number; sunset: number; use24: boolean; frozen: boolean }) {
  const now = useNowSeconds(today, frozen, 30) / 3600;
  const day = now >= sunrise && now < sunset;
  const text = day
    ? `${span(sunset - now)} of daylight left · sunset ${formatHour(sunset, use24)}`
    : now < sunrise
      ? `Sun is down · sunrise ${formatHour(sunrise, use24)}`
      : `Sun is down · sunrise tomorrow ${formatHour(sunrise, use24)}`;
  return (
    <div className="hello__sun">
      <i data-phase={day ? "day" : "night"} aria-hidden />
      {text}
    </div>
  );
}
