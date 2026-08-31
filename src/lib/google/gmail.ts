/**
 * Phase 4 — "Needs a reply" via Gmail API v1 (read-only).
 *
 * Urgency is a heuristic: Gmail's own IMPORTANT signal plus age.
 */

import "server-only";
import { config } from "@/lib/config";
import { relativeAge } from "@/lib/time";
import type { Reply, Urgency } from "@/lib/types";
import { getGoogleAccessToken } from "./tokens";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

interface GmailListResponse {
  messages?: { id: string; threadId: string }[];
}

interface GmailMessage {
  id: string;
  internalDate: string;
  labelIds?: string[];
  payload?: { headers?: { name: string; value: string }[] };
}

function header(msg: GmailMessage, name: string): string {
  return (
    msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())
      ?.value ?? ""
  );
}

/** '"Priya Raman" <priya@x.com>' → "Priya Raman"; bare address → local part. */
function displayName(from: string): string {
  const quoted = from.match(/^\s*"?([^"<]+?)"?\s*</);
  if (quoted) return quoted[1].trim();
  const addr = from.match(/([^<>\s@]+)@[^<>\s]+/);
  if (addr) {
    return addr[1]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return from.trim() || "Unknown";
}

function urgencyOf(msg: GmailMessage, now: Date): Urgency {
  const ageHours = (now.getTime() - Number(msg.internalDate)) / 3_600_000;
  const important = msg.labelIds?.includes("IMPORTANT") ?? false;
  if (important && ageHours < 48) return 1;
  if (ageHours < 24) return 2;
  if (ageHours > 72) return 3;
  return 2;
}

const NOTE: Record<Urgency, string> = {
  1: "Waiting on you",
  2: "Needs an answer",
  3: "Can wait",
};

export async function getReplies(): Promise<Reply[]> {
  const token = await getGoogleAccessToken();
  const auth = { Authorization: `Bearer ${token}` };

  const listUrl = new URL(`${BASE}/messages`);
  listUrl.searchParams.set("q", config.google.gmailQuery);
  // Over-fetch — bulk / no-reply mail is filtered out below before we take 8.
  listUrl.searchParams.set("maxResults", "50");

  const listRes = await fetch(listUrl, { headers: auth, next: { revalidate: 90 } });
  if (!listRes.ok) throw new Error(`Gmail list responded ${listRes.status}`);
  const list = (await listRes.json()) as GmailListResponse;
  const ids = (list.messages ?? []).map((m) => m.id);
  if (ids.length === 0) return [];

  const now = new Date();
  const messages = await Promise.all(
    ids.map(async (id) => {
      const url = new URL(`${BASE}/messages/${id}`);
      url.searchParams.set("format", "metadata");
      for (const h of ["From", "Subject", "Date", "List-Unsubscribe", "Precedence"]) {
        url.searchParams.append("metadataHeaders", h);
      }
      const res = await fetch(url, { headers: auth, next: { revalidate: 90 } });
      if (!res.ok) throw new Error(`Gmail message ${id} responded ${res.status}`);
      return (await res.json()) as GmailMessage;
    }),
  );

  return messages
    .filter((msg) => !looksLikeBulk(msg))
    .map<Reply>((msg) => {
      const urgency = urgencyOf(msg, now);
      return {
        id: msg.id,
        from: displayName(header(msg, "From")),
        subject: header(msg, "Subject") || "(no subject)",
        age: relativeAge(new Date(Number(msg.internalDate)), now),
        note: NOTE[urgency],
        urgency,
      };
    })
    .sort(
      (a, b) =>
        a.urgency - b.urgency ||
        ageMinutes(b.age) - ageMinutes(a.age),
    )
    .slice(0, 8);
}

const NO_REPLY_RE = /(^|[.\-_+])(no[.\-_]?reply|do[.\-_]?not[.\-_]?reply|donotreply|notification[s]?|noreply|mailer[-_]?daemon|newsletter|bounce)@/i;

/**
 * Bulk / automated mail that a human is not waiting on a reply to. Kept out:
 *   - anything with a List-Unsubscribe header or Precedence: bulk/list
 *   - Gmail's Promotions / Social / Forums categories
 *   - Gmail's Updates category, UNLESS Gmail also flagged it Important
 *     (that's how a shared doc / a real notification still gets through)
 *   - noreply-style senders
 */
function looksLikeBulk(msg: GmailMessage): boolean {
  const labels = msg.labelIds ?? [];
  const important = labels.includes("IMPORTANT");

  if (header(msg, "List-Unsubscribe")) return true;
  if (/bulk|list|auto_reply/i.test(header(msg, "Precedence"))) return true;
  if (labels.includes("CATEGORY_PROMOTIONS")) return true;
  if (labels.includes("CATEGORY_SOCIAL")) return true;
  if (labels.includes("CATEGORY_FORUMS")) return true;
  if (labels.includes("CATEGORY_UPDATES") && !important) return true;

  const addr = header(msg, "From").match(/[^<>\s@]+@[^<>\s]+/)?.[0] ?? "";
  return NO_REPLY_RE.test(`${addr.split("@")[0]}@`);
}

/** Rough re-parse of "18h" / "2d" back to minutes, for sorting only. */
function ageMinutes(age: string): number {
  const n = parseInt(age, 10) || 0;
  if (age.endsWith("d")) return n * 1440;
  if (age.endsWith("h")) return n * 60;
  if (age.endsWith("m")) return n;
  return 0;
}
