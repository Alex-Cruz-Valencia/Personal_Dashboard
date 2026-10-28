"use client";

import type { TodayInfo } from "@/lib/types";
import { useNowSeconds } from "@/lib/use-now";

interface ClockCardProps {
  today: TodayInfo;
  use24: boolean;
  /** Demo mode pins "now" to the sample day, so the clock must not run ahead of it. */
  frozen: boolean;
}

/** Just the time. Where you are in the day, and what's next, live in the calendar. */
export function ClockCard({ today, use24, frozen }: ClockCardProps) {
  const secs = useNowSeconds(today, frozen);
  const hh = Math.floor(secs / 3600) % 24;
  const mm = Math.floor((secs % 3600) / 60);
  const ss = secs % 60;
  const h12 = hh % 12 === 0 ? 12 : hh % 12;

  return (
    <div className="clock" aria-label="Time">
      <div className="clock__time" role="timer" aria-live="off">
        <span className="clock__hm">
          {use24 ? String(hh).padStart(2, "0") : h12}
          <span className="clock__colon">:</span>
          {String(mm).padStart(2, "0")}
        </span>
        <span className="clock__side">
          <span className="clock__sec">{String(ss).padStart(2, "0")}</span>
          {use24 ? null : <span className="clock__ampm">{hh >= 12 ? "pm" : "am"}</span>}
        </span>
      </div>
    </div>
  );
}
