"use client";

/**
 * The one pending "Undo" on the page. Whatever made a change offers its reverse here, and
 * `UndoToast` shows it for a few seconds. A newer offer replaces the last: only the latest
 * thing you did can be taken back, the same as Gmail's.
 */

import { useSyncExternalStore } from "react";

export interface UndoOffer {
  id: number;
  text: string;
  undo: () => Promise<void>;
}

let offer: UndoOffer | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function set(next: UndoOffer | null) {
  offer = next;
  listeners.forEach((l) => l());
}

export function offerUndo(text: string, undo: () => Promise<void>) {
  set({ id: nextId++, text, undo });
}

export function clearUndo() {
  set(null);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useUndoOffer(): UndoOffer | null {
  return useSyncExternalStore(subscribe, () => offer, () => null);
}

/** A write that throws when the server refuses, for the reverse of something just done. */
export async function write(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<void> {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error("Undo failed");
}
