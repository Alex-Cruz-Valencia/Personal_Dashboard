/**
 * "Waiting on others": emails I sent that nobody has answered yet. Pure, so it's tested without
 * Gmail. The Gmail reads that feed it live in `google/gmail.ts`.
 */

/** One message of a thread, reduced to what the check needs. */
export interface MailLite {
  /** Gmail message id. */
  id?: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  /** Sent time, ms since the epoch. */
  at: number;
  draft?: boolean;
}

export interface ThreadLite {
  id: string;
  messages: MailLite[];
}

/** A sent email still waiting on an answer, as the page shows it. */
export interface WaitingPick {
  id: string;
  to: string;
  subject: string;
  /** Whole days since I sent it. */
  days: number;
  /** My last message's id ("" when Gmail didn't give one). */
  lastId: string;
}

/** Quieter than this and it's too early to call it waiting; older and it's let go. */
export const WAIT_MIN_DAYS = 2;
export const WAIT_MAX_DAYS = 21;

const DAY = 86_400_000;
const NO_REPLY = /\b(no-?reply|do-?not-?reply|notifications?|mailer-daemon)@/i;
/** Signs that the email expects an answer, not just informs. */
const ASKS = /\?|\b(let me know|could you|can you|would you|are you able|please (confirm|send|share|review|advise)|any update|thoughts|when (works|would)|following up|circling back)\b/i;

const addresses = (field: string) => (field.match(/[^<>\s,;"]+@[^<>\s,;"]+/g) ?? []).map((a) => a.toLowerCase());

/** '"Priya Raman" <priya@x.com>, sam@y.com' → "Priya Raman +1". */
function people(field: string): string {
  const parts = field.split(",").map((p) => p.trim()).filter(Boolean);
  const name = (p: string) => p.match(/^\s*"?([^"<]+?)"?\s*</)?.[1].trim() ?? p.replace(/[<>]/g, "").split("@")[0];
  if (!parts.length) return "Someone";
  return parts.length > 1 ? `${name(parts[0])} +${parts.length - 1}` : name(parts[0]);
}

/**
 * Threads whose last real message is mine, sent 2–21 days ago to someone other than me (and not
 * to a no-reply address), that asked for something. Oldest first.
 */
export function pickWaiting(threads: ThreadLite[], me: string, now: number): WaitingPick[] {
  const self = me.toLowerCase();
  const out: WaitingPick[] = [];
  for (const t of threads) {
    const last = t.messages.filter((m) => !m.draft).sort((a, b) => a.at - b.at).at(-1);
    if (!last || !addresses(last.from).includes(self)) continue;
    const days = Math.floor((now - last.at) / DAY);
    if (days < WAIT_MIN_DAYS || days > WAIT_MAX_DAYS) continue;
    const others = addresses(last.to).filter((a) => a !== self);
    if (!others.length || others.every((a) => NO_REPLY.test(a))) continue;
    if (!ASKS.test(`${last.subject} ${last.snippet}`)) continue;
    out.push({ id: t.id, to: people(last.to), subject: last.subject || "(no subject)", days, lastId: last.id ?? "" });
  }
  return out.sort((a, b) => b.days - a.days);
}
