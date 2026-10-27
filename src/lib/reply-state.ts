"use client";

/**
 * Which replies are hidden from the dashboard right now, shared by the reply
 * list, the attention strip and its popover.
 * - cleared: trashed or moved this session (optimistic; the page refresh
 *   reconciles it with Gmail).
 * - snoozed ("Wait"): hidden for a while, remembered in this browser only.
 * Nothing here is written to Gmail.
 */

import { useSyncExternalStore } from "react";

const KEY = "dashboard_snoozed";
export const SNOOZE_HOURS = 24;

interface State {
  snoozed: Record<string, number>;
  cleared: ReadonlySet<string>;
  /** cleared + still-snoozed ids, computed when the state changes (a snooze that
   *  runs out is picked up on the next page load). */
  hidden: ReadonlySet<string>;
}

const EMPTY: State = { snoozed: {}, cleared: new Set(), hidden: new Set() };

function make(snoozed: Record<string, number>, cleared: ReadonlySet<string>): State {
  return { snoozed, cleared, hidden: new Set([...cleared, ...Object.keys(snoozed)]) };
}
let state: State | null = null;
const listeners = new Set<() => void>();

function readSnoozed(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const now = Date.now();
    return Object.fromEntries(Object.entries(parsed).filter(([, until]) => until > now));
  } catch {
    return {};
  }
}

function writeSnoozed(map: Record<string, number>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* private mode: it still works for this page view */
  }
}

function current(): State {
  if (!state) state = make(readSnoozed(), new Set());
  return state;
}

function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

export function snoozeReply(id: string, hours = SNOOZE_HOURS) {
  const s = current();
  const snoozed = { ...s.snoozed, [id]: Date.now() + hours * 3_600_000 };
  writeSnoozed(snoozed);
  set(make(snoozed, s.cleared));
}

export function hideReply(id: string) {
  const s = current();
  set(make(s.snoozed, new Set(s.cleared).add(id)));
}

export function showReply(id: string) {
  const s = current();
  const cleared = new Set(s.cleared);
  cleared.delete(id);
  set(make(s.snoozed, cleared));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Ids to leave out of every reply view. Empty during server render and hydration. */
export function useHiddenReplyIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, current, () => EMPTY).hidden;
}
