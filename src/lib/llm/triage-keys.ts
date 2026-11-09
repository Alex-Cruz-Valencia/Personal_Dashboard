import type { Nudge, TriageAction, TriageSuggestion } from "@/lib/types";

/**
 * Pure helpers for the background triage store, so they're tested without Redis.
 * Keys: `r:<messageId>` for an email in the reply queue, `w:<messageId>` for a Waiting on thread,
 * keyed by my last message so sending another follow-up gets a fresh look.
 */

/** An email is looked at again after this long, in case the model or my profile changed. */
export const KEEP_MS = 3 * 86_400_000;

export type StoredTriage =
  | { kind: "reply"; at: number; suggestion: TriageSuggestion | null }
  | { kind: "waiting"; at: number; nudge: Nudge };

export const replyKey = (messageId: string) => `r:${messageId}`;
export const waitingKey = (lastId: string) => `w:${lastId}`;

const ACTIONS: readonly TriageAction[] = ["trash", "task", "reply", "file", "leave"];
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** A stored value back into shape, or null when it's malformed or too old. */
export function cleanStored(raw: unknown, now: number): StoredTriage | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const at = typeof r.at === "number" ? r.at : NaN;
  if (!Number.isFinite(at) || now - at > KEEP_MS || at > now + 60_000) return null;
  if (r.kind === "reply") {
    if (r.suggestion === null) return { kind: "reply", at, suggestion: null };
    const s = (r.suggestion ?? {}) as Record<string, unknown>;
    const action = ACTIONS.find((a) => a === s.action);
    const id = str(s.id, 64);
    if (!action || !id) return null;
    const label = str(s.label, 120);
    return { kind: "reply", at, suggestion: { id, action, reason: str(s.reason, 140), ...(label ? { label } : {}) } };
  }
  if (r.kind === "waiting") {
    const n = (r.nudge ?? {}) as Record<string, unknown>;
    if (n.action !== "nudge" && n.action !== "let_go") return null;
    const draft = str(n.draft, 1500);
    return {
      kind: "waiting",
      at,
      nudge: { action: n.action, reason: str(n.reason, 140), ...(n.action === "nudge" && draft ? { draft } : {}) },
    };
  }
  return null;
}

/**
 * The model's answer for one Waiting on thread → a checked suggestion, or null. The thread is
 * untrusted, so only a known action, a short plain reason and a plain-text draft are kept; a nudge
 * with no usable draft is still a nudge, just without the text.
 */
export function parseNudge(text: string): Nudge | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const action = raw.action === "nudge" || raw.action === "let_go" ? raw.action : null;
  if (!action) return null;
  const reason = typeof raw.reason === "string" ? raw.reason.replace(/\s+/g, " ").trim().slice(0, 140) : "";
  const draft =
    action === "nudge" && typeof raw.draft === "string"
      ? raw.draft.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 1500)
      : "";
  return { action, reason, ...(draft ? { draft } : {}) };
}

/** What the background pass still has to look at: ids with nothing stored, oldest-first order kept. */
export function missingKeys(keys: string[], stored: Map<string, StoredTriage>): string[] {
  return [...new Set(keys)].filter((k) => !stored.has(k));
}
