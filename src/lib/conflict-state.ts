"use client";

/**
 * Conflicts and tight turnarounds the viewer has said are fine ("It's fine" in the attention
 * strip). Keyed by the events and their exact times, so if either one moves the warning can
 * come back. Remembered in this browser at once, and on the server for the day so every device
 * agrees (`/api/conflicts/ok`; the page passes today's server list back in). Nothing is
 * written to Google.
 */

import { useMemo, useSyncExternalStore } from "react";

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
  // Shared with other devices; the public demo has no store and says no, which is fine.
  fetch("/api/conflicts/ok", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
    keepalive: true,
  }).catch(() => {});
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Keys of the conflicts marked fine: this browser's, plus `shared` from the server (marked on
 * any device today). Only the shared ones during server render and hydration.
 */
export function useDismissedConflicts(shared: readonly string[] = []): ReadonlySet<string> {
  const local = useSyncExternalStore(subscribe, current, () => EMPTY);
  return useMemo(() => (shared.length ? new Set([...local, ...shared]) : local), [local, shared]);
}
