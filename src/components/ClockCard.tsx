"use client";

import { useSyncExternalStore } from "react";
import { upNext } from "@/lib/attention";
import { arcPct, formatHour } from "@/lib/format";
import type { AgendaEvent, ArcWindow, TodayInfo } from "@/lib/types";

interface ClockCardProps {
  today: TodayInfo;
  arc: ArcWindow;
  agenda: AgendaEvent[];
  sunrise: number;
  sunset: number;
  use24: boolean;
  /** Demo mode pins "now" to the sample day, so the clock must not run ahead of it. */
  frozen: boolean;
}

const formats = new Map<string, Intl.DateTimeFormat>();

/** Seconds since midnight in `timeZone` (the dashboard's zone, not necessarily the browser's). */
function secondsOfDay(timeZone: string, ms: number): number {
  try {
    let f = formats.get(timeZone);
    if (!f) {
      f = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", hour: "numeric", minute: "numeric", second: "numeric" });
      formats.set(timeZone, f);
    }
    const part = (t: string) => Number(f.formatToParts(ms).find((p) => p.type === t)?.value ?? 0);
    return (part("hour") % 24) * 3600 + part("minute") * 60 + part("second");
  } catch {
    const d = new Date(ms);
    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  }
}

function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}

const never = () => () => {};

function span(hours: number): string {
  const m = Math.max(0, Math.round(hours * 60));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export function ClockCard({ today, arc, agenda, sunrise, sunset, use24, frozen }: ClockCardProps) {
  const serverSecs = Math.round(today.nowHour * 3600);
  // The server's value is what hydration renders; the live clock takes over right after.
  const secs = useSyncExternalStore(
    frozen ? never : subscribe,
    () => (frozen ? serverSecs : secondsOfDay(today.timezone, Date.now())),
    () => serverSecs,
  );

  const now = secs / 3600;
  const hh = Math.floor(secs / 3600) % 24;
  const mm = Math.floor((secs % 3600) / 60);
  const ss = secs % 60;
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const ampm = hh >= 12 ? "pm" : "am";

  const inDay = now >= arc.from && now < arc.to;
  const isDay = now >= sunrise && now < sunset;
  const next = upNext(agenda, now);

  const status = inDay
    ? `${span(arc.to - now)} left in your day`
    : now < arc.from
      ? `Your day starts at ${formatHour(arc.from, use24)}`
      : "Your day is done";

  return (
    <section className="card clock" aria-label="Time">
      <div className="clock__label">Right now</div>
      <div className="clock__time" role="timer" aria-live="off">
        <span className="clock__hm">
          {use24 ? String(hh).padStart(2, "0") : h12}
          <span className="clock__colon">:</span>
          {String(mm).padStart(2, "0")}
        </span>
        <span className="clock__side">
          <span className="clock__sec">{String(ss).padStart(2, "0")}</span>
          {use24 ? null : <span className="clock__ampm">{ampm}</span>}
        </span>
      </div>

      <div className="clock__rail" role="img" aria-label={status}>
        <span className="clock__fill" style={{ width: `${arcPct(now, arc)}%` }} />
        <span className="clock__pip" style={{ left: `${arcPct(now, arc)}%` }} data-phase={isDay ? "day" : "night"} />
      </div>
      <div className="clock__ends">
        <span>{formatHour(arc.from, use24).replace(":00", "")}</span>
        <span>{status}</span>
        <span>{formatHour(arc.to, use24).replace(":00", "")}</span>
      </div>

      {next ? (
        <div className="clock__next">
          <span className="clock__next-tag">{next.mode === "now" ? "Now" : "Next"}</span>
          <span className="clock__next-name">{next.name}</span>
          <span className="clock__next-when">{next.mode === "now" ? `${span(next.minutes / 60)} left` : `in ${span(next.minutes / 60)}`}</span>
        </div>
      ) : (
        <div className="clock__next clock__next--none">Nothing else on the calendar</div>
      )}
    </section>
  );
}
