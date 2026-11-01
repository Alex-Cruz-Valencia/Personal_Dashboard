"use client";

import { hideReply, showReply, snoozeReply, unsnoozeReply } from "./reply-state";
import { offerUndo, write } from "./undo";

export interface LabelInfo {
  name: string;
  textColor?: string;
  backgroundColor?: string;
}

/** Gmail's own link for a message — where "Reply" happens. */
export const gmailLink = (id: string) => `https://mail.google.com/mail/u/0/#inbox/${id}`;

/** Hide the reply now; bring it back if Gmail refuses. Resolves true on success. */
async function optimistic(id: string, run: () => Promise<Response>): Promise<boolean> {
  hideReply(id);
  try {
    const res = await run();
    if (!res.ok) throw new Error();
    return true;
  } catch {
    showReply(id);
    return false;
  }
}

export async function trashReply(id: string): Promise<boolean> {
  const ok = await optimistic(id, () => fetch(`/api/replies/${id}/trash`, { method: "POST" }));
  if (ok) {
    offerUndo("Email moved to Trash", async () => {
      await write(`/api/replies/${id}/restore`, "POST");
      showReply(id);
    });
  }
  return ok;
}

export async function moveReply(id: string, label: string): Promise<boolean> {
  const ok = await optimistic(id, () =>
    fetch(`/api/replies/${id}/move`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label }),
    }),
  );
  if (ok) {
    offerUndo(`Email moved to ${label}`, async () => {
      await write(`/api/replies/${id}/restore`, "POST", { label });
      showReply(id);
    });
  }
  return ok;
}

/** "Wait a day": hidden in this browser only, so its undo touches nothing else. */
export function waitReply(id: string) {
  snoozeReply(id);
  offerUndo("Hidden for a day", async () => unsnoozeReply(id));
}

/** The page stays open all day, so a new label shows up within this long. */
const LABELS_FRESH_MS = 5 * 60_000;
let labelPromise: Promise<LabelInfo[]> | null = null;
let labelsAt = 0;

/** Gmail's labels, reused for a few minutes. A failed load isn't kept. */
export function loadLabels(): Promise<LabelInfo[]> {
  if (!labelPromise || Date.now() - labelsAt >= LABELS_FRESH_MS) {
    labelsAt = Date.now();
    labelPromise = fetch("/api/replies/meta")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((m: { labels: LabelInfo[] }) => m.labels)
      .catch(() => {
        labelPromise = null;
        return [];
      });
  }
  return labelPromise;
}

export type TriageAction = "trash" | "task" | "reply" | "file" | "leave";

export interface TriageSuggestion {
  id: string;
  action: TriageAction;
  label?: string;
  reason: string;
}

/** id → suggestion (null: asked, but the model had none). Kept for the page load, so reopening the queue costs nothing. */
const triageCache = new Map<string, TriageSuggestion | null>();

/** AI suggestions for these emails; only ids not asked about yet go to the server. Read-only. */
const TRIAGE_BATCH = 8;

export async function loadTriage(ids: string[]): Promise<Map<string, TriageSuggestion | null>> {
  // One call reads at most this many; the oldest of a long queue simply go without.
  const missing = ids.filter((id) => !triageCache.has(id)).slice(0, TRIAGE_BATCH);
  if (missing.length) {
    const res = await fetch("/api/replies/triage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: missing }),
    });
    const body = (await res.json().catch(() => ({}))) as { suggestions?: TriageSuggestion[]; error?: string };
    if (!res.ok || !body.suggestions) throw new Error(body.error || "Couldn't get suggestions.");
    for (const id of missing) triageCache.set(id, body.suggestions.find((s) => s.id === id) ?? null);
  }
  return new Map(ids.map((id) => [id, triageCache.get(id) ?? null]));
}
