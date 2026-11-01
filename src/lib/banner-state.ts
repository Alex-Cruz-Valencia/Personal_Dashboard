"use client";

/**
 * All-day banners hidden from the day calendar. This browser only; nothing is written to Google,
 * and the event stays in Google Calendar and the week view. A repeating event's next occurrence
 * has its own id, so it comes back. Kept for 90 days, which outlasts any banner worth hiding.
 */

import { useSyncExternalStore } from "react";

const KEY = "dashboard_hidden_banners";
const KEEP_MS = 90 * 86_400_000;

const EMPTY: ReadonlySet<string> = new Set();
let until: Record<string, number> | null = null;
let snapshot: ReadonlySet<string> = EMPTY;
const listeners = new Set<() => void>();

function current(): ReadonlySet<string> {
  if (!until) {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
      const now = Date.now();
      until = Object.fromEntries(Object.entries(parsed).filter(([, t]) => t > now));
    } catch {
      until = {};
    }
    snapshot = new Set(Object.keys(until));
  }
  return snapshot;
}

function save(next: Record<string, number>) {
  until = next;
  snapshot = new Set(Object.keys(next));
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode: it still holds for this page view */
  }
  listeners.forEach((l) => l());
}

export function hideBanner(id: string) {
  current();
  save({ ...until, [id]: Date.now() + KEEP_MS });
}

export function showBanner(id: string) {
  current();
  save(Object.fromEntries(Object.entries(until ?? {}).filter(([k]) => k !== id)));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Ids of the hidden banners. Empty during server render and hydration. */
export function useHiddenBanners(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, current, () => EMPTY);
}
