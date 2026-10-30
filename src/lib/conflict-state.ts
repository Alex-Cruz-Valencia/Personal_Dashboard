"use client";

/**
 * Conflicts and tight turnarounds the viewer has said are fine ("It's fine" in the attention
 * strip). Keyed by the events and their exact times, so if either one moves the warning can
 * come back. Remembered in this browser for two days; nothing is written to Google.
 */

import { useSyncExternalStore } from "react";

const KEY = "dashboard_ok_conflicts";
const KEEP_MS = 2 * 86_400_000;

const EMPTY: ReadonlySet<string> = new Set();
let okUntil: Record<string, number> | null = null;
let snapshot: ReadonlySet<string> = EMPTY;
const listeners = new Set<() => void>();

function load(): Record<string, number> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
    const now = Date.now();
    return Object.fromEntries(Object.entries(parsed).filter(([, until]) => until > now));
  } catch {
    return {};
  }
}

function current(): ReadonlySet<string> {
  if (!okUntil) {
    okUntil = load();
    snapshot = new Set(Object.keys(okUntil));
  }
  return snapshot;
}

export function dismissConflict(key: string) {
  current();
  okUntil = { ...okUntil, [key]: Date.now() + KEEP_MS };
  snapshot = new Set(Object.keys(okUntil));
  try {
    window.localStorage.setItem(KEY, JSON.stringify(okUntil));
  } catch {
    /* private mode: it still holds for this page view */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Keys of the conflicts marked fine. Empty during server render and hydration. */
export function useDismissedConflicts(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, current, () => EMPTY);
}
