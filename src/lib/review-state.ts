"use client";

/**
 * Whether the day review is open, shared by the task card that shows it and the banner and chip
 * that open it, plus "Later" on the banner: hidden until the next review, in this browser only.
 */

import { useSyncExternalStore } from "react";

const KEY = "dashboard_review_later";

let open = false;
let later: string | null | undefined;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

export function setReviewOpen(next: boolean) {
  open = next;
  changed();
}

function readLater(): string | null {
  if (later === undefined) {
    try {
      later = window.localStorage.getItem(KEY);
    } catch {
      later = null;
    }
  }
  return later;
}

/** `slot` names this review (the day and mode), so the next one shows again by itself. */
export function hideReviewPrompt(slot: string) {
  later = slot;
  try {
    window.localStorage.setItem(KEY, slot);
  } catch {
    /* private mode: it still works for this page view */
  }
  changed();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export const useReviewOpen = () => useSyncExternalStore(subscribe, () => open, () => false);

export const useReviewLater = () => useSyncExternalStore(subscribe, readLater, () => null);
