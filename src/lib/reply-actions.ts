"use client";

import { hideReply, showReply } from "./reply-state";

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

export const trashReply = (id: string) =>
  optimistic(id, () => fetch(`/api/replies/${id}/trash`, { method: "POST" }));

export const moveReply = (id: string, label: string) =>
  optimistic(id, () =>
    fetch(`/api/replies/${id}/move`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label }),
    }),
  );

let labelPromise: Promise<LabelInfo[]> | null = null;

/** Gmail's labels, fetched once per page load and reused. */
export function loadLabels(): Promise<LabelInfo[]> {
  if (!labelPromise) {
    labelPromise = fetch("/api/replies/meta")
      .then((r) => (r.ok ? r.json() : { labels: [] }))
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
export async function loadTriage(ids: string[]): Promise<Map<string, TriageSuggestion | null>> {
  const missing = ids.filter((id) => !triageCache.has(id));
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
