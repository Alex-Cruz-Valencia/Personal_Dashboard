"use client";

import { useSyncExternalStore } from "react";
import type { TodayInfo } from "@/lib/types";

const formats = new Map<string, Intl.DateTimeFormat>();

/** Seconds since midnight in `timeZone` (the dashboard's zone, not necessarily the browser's). */
export function secondsOfDay(timeZone: string, ms: number): number {
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

/**
 * Seconds since midnight, ticking locally in the dashboard's timezone and
 * quantised to `stepSec` so slow consumers only re-render that often.
 * Hydrates from the server's time first. `frozen` (demo mode) pins it there.
 */
export function useNowSeconds(today: TodayInfo, frozen: boolean, stepSec = 1): number {
  const server = Math.round(today.nowHour * 3600);
  return useSyncExternalStore(
    frozen ? never : subscribe,
    () => (frozen ? server : Math.floor(secondsOfDay(today.timezone, Date.now()) / stepSec) * stepSec),
    () => server,
  );
}
