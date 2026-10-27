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
