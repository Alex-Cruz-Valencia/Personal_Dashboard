import "server-only";
import { features, forceMock, isDemoMode } from "@/lib/config";
import { getMessageForDraft, listGmailLabels } from "@/lib/google/gmail";
import type { Nudge, Reply, TriageSuggestion, Waiting } from "@/lib/types";
import { readEmailProfile } from "./email-profile";
import { suggestNudge } from "./nudge";
import { triageEmails } from "./triage";
import { missingKeys, replyKey, waitingKey, type StoredTriage } from "./triage-keys";
import { readTriage, writeTriage } from "./triage-store";

/**
 * Triage ahead of time. Each page render reads what's already done (fast, no model call) and, once
 * the response has gone out, looks at whatever is new: every email in the reply queue, and every
 * Waiting on thread. Results land in the store, so the next render (the page refreshes itself every
 * minute) has them. Proposals only: nothing here writes to Gmail.
 */

/** Same batch size the reply queue used, so each call stays under the client's input cap. */
const BATCH = 8;
/** Model calls in flight at once. */
const PARALLEL = 6;
/** In case something loops: model calls per hour from the background pass, per server instance. */
const MAX_CALLS_PER_HOUR = 60;
const HOUR = 3_600_000;

const calls: number[] = [];
let running: Promise<void> | null = null;

const enabled = () => features.llm && features.google && !isDemoMode && !forceMock;

function takeCall(): boolean {
  const now = Date.now();
  while (calls.length && calls[0] < now - HOUR) calls.shift();
  if (calls.length >= MAX_CALLS_PER_HOUR) return false;
  calls.push(now);
  return true;
}

/** Run `jobs` with at most PARALLEL at a time; a failed job just leaves its emails for next time. */
async function pool(jobs: (() => Promise<void>)[]): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      await job().catch(() => undefined);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, jobs.length) }, worker));
}

/** What's already been worked out for this render's emails. Never calls the model. */
export async function storedTriage(
  replies: Reply[],
  waiting: Waiting[],
): Promise<{ triage: Record<string, TriageSuggestion | null>; nudges: Record<string, Nudge> }> {
  const empty = { triage: {}, nudges: {} };
  if (!enabled()) return empty;
  const mail = replies.flatMap((r) => (r.id ? [r.id] : []));
  const withLast = waiting.filter((w) => w.lastId);
  try {
    const stored = await readTriage([...mail.map(replyKey), ...withLast.map((w) => waitingKey(w.lastId))]);
    const triage: Record<string, TriageSuggestion | null> = {};
    for (const id of mail) {
      const v = stored.get(replyKey(id));
      if (v?.kind === "reply") triage[id] = v.suggestion;
    }
    const nudges: Record<string, Nudge> = {};
    for (const w of withLast) {
      const v = stored.get(waitingKey(w.lastId));
      if (v?.kind === "waiting") nudges[w.id] = v.nudge;
    }
    return { triage, nudges };
  } catch {
    return empty;
  }
}

/** Look at everything not yet triaged. One pass at a time per server; a second call waits for it. */
export function fillTriage(replies: Reply[], waiting: Waiting[]): Promise<void> {
  if (!enabled() || (!replies.length && !waiting.length)) return Promise.resolve();
  if (!running) {
    running = fill(replies, waiting).finally(() => {
      running = null;
    });
  }
  return running;
}

async function fill(replies: Reply[], waiting: Waiting[]): Promise<void> {
  const mail = replies.flatMap((r) => (r.id ? [replyKey(r.id)] : []));
  const withLast = waiting.filter((w) => w.lastId);
  const stored = await readTriage([...mail, ...withLast.map((w) => waitingKey(w.lastId))]).catch(
    () => new Map<string, StoredTriage>(),
  );
  const replyIds = missingKeys(mail, stored).map((k) => k.slice(2));
  const todo = withLast.filter((w) => !stored.has(waitingKey(w.lastId)));
  if (!replyIds.length && !todo.length) return;

  const results = new Map<string, StoredTriage>();
  const jobs: (() => Promise<void>)[] = [];

  if (replyIds.length) {
    const context = Promise.all([listGmailLabels().then((ls) => ls.map((l) => l.name)), readEmailProfile()]);
    for (let i = 0; i < replyIds.length; i += BATCH) {
      const ids = replyIds.slice(i, i + BATCH);
      jobs.push(async () => {
        if (!takeCall()) return;
        const [[labels, profile], settled] = await Promise.all([
          context,
          Promise.allSettled(ids.map(async (id) => ({ id, ...(await getMessageForDraft(id)) }))),
        ]);
        const emails = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
        if (!emails.length) return;
        const suggestions = await triageEmails(emails, labels, profile);
        const at = Date.now();
        // An email the model was shown but said nothing about is stored as "nothing to suggest".
        for (const e of emails) {
          results.set(replyKey(e.id), { kind: "reply", at, suggestion: suggestions.find((s) => s.id === e.id) ?? null });
        }
      });
    }
  }

  for (const w of todo) {
    jobs.push(async () => {
      if (!takeCall()) return;
      const msg = await getMessageForDraft(w.lastId);
      if (!msg.body.trim()) return;
      const nudge = await suggestNudge({ to: w.to, subject: w.subject, days: w.days, body: msg.body });
      if (nudge) results.set(waitingKey(w.lastId), { kind: "waiting", at: Date.now(), nudge });
    });
  }

  await pool(jobs);
  await writeTriage(results).catch(() => undefined);
}

/** Results from the reply queue's own on-demand call, kept so they aren't asked for twice. */
export async function rememberTriage(ids: string[], suggestions: TriageSuggestion[]): Promise<void> {
  if (!enabled()) return;
  const at = Date.now();
  const entries = new Map<string, StoredTriage>(
    ids.map((id) => [replyKey(id), { kind: "reply", at, suggestion: suggestions.find((s) => s.id === id) ?? null }]),
  );
  await writeTriage(entries).catch(() => undefined);
}
