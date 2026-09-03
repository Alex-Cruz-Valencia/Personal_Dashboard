/**
 * Phase 4 — the "Needs a reply" card via Gmail API v1 (read-only).
 *
 * Goal: surface mail actually worth attention. Marketing / social / bulk
 * newsletters are dropped; genuine threads (a shared doc, a recruiter, an
 * "action required", a real person) are kept — read OR unread, because people
 * often read a message and reply later.
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

const MAILER_RE = /(mailer[-_]?daemon|postmaster|bounce[s]?|delivery[-_]?status)@/i;

/** Bulk / automated mail a human isn't expected to act on. */
function looksLikeBulk(msg: GmailMessage): boolean {
  const labels = msg.labelIds ?? [];
  const important = labels.includes("IMPORTANT");

  if (labels.includes("CATEGORY_PROMOTIONS")) return true;
  if (labels.includes("CATEGORY_SOCIAL")) return true;

  // A List-Unsubscribe header (or Precedence: bulk) means a mailing list —
  // drop it unless Gmail flagged it important (recruiter blasts, calendar
  // invites and shared-doc notices sometimes carry one).
  const bulkHeader =
    Boolean(header(msg, "List-Unsubscribe")) ||
    /\b(bulk|list|auto_reply)\b/i.test(header(msg, "Precedence"));
  if (bulkHeader && !important) return true;

  const addr = header(msg, "From").match(/[^<>\s]+@[^<>\s]+/)?.[0] ?? "";
  return MAILER_RE.test(addr);
}

/** Short chip + urgency, from the subject, unread state and importance. */
function classify(
  msg: GmailMessage,
  subject: string,
): { note: string; urgency: Urgency } {
  const s = subject.toLowerCase();
  const unread = msg.labelIds?.includes("UNREAD") ?? false;
  const important = msg.labelIds?.includes("IMPORTANT") ?? false;

  if (/\b(action required|please (verify|confirm|sign|review|approve|complete)|verify your|payment|overdue|past due|deadline)\b/.test(s)) {
    return { note: "Action needed", urgency: 1 };
  }
  if (/\b(shared (with you|a document)|via google (docs|drive|sheets)|added you)\b/.test(s)) {
    return { note: "Shared with you", urgency: 2 };
  }
  if (/\b(invitation to|invites you|has invited you|you'?re invited)\b/.test(s)) {
    return { note: "Invite", urgency: 2 };
  }
  if (s.includes("?") || /\b(can you|could you|are you able|let me know|thoughts\??|feedback)\b/.test(s)) {
    return { note: "Question", urgency: 2 };
  }
  if (/^re:/i.test(subject) || /\bre:/i.test(subject)) {
    return { note: "In a thread", urgency: unread ? 2 : 3 };
  }
  if (unread && important) return { note: "Flagged", urgency: 2 };
  if (unread) return { note: "Unread", urgency: 3 };
  return { note: "FYI", urgency: 3 };
}

export async function getReplies(): Promise<Reply[]> {
  const token = await getGoogleAccessToken();
  const auth = { Authorization: `Bearer ${token}` };

  const listUrl = new URL(`${BASE}/messages`);
  listUrl.searchParams.set("q", config.google.gmailQuery);
  listUrl.searchParams.set("maxResults", "40");

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
      for (const h of ["From", "Subject", "List-Unsubscribe", "Precedence"]) {
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
      const subject = header(msg, "Subject") || "(no subject)";
      const { note, urgency } = classify(msg, subject);
      return {
        id: msg.id,
        from: displayName(header(msg, "From")),
        subject,
        age: relativeAge(new Date(Number(msg.internalDate)), now),
        note,
        urgency,
        unread: msg.labelIds?.includes("UNREAD") ?? false,
      };
    })
    .sort(
      (a, b) =>
        Number(b.unread) - Number(a.unread) ||
        a.urgency - b.urgency ||
        ageMinutes(a.age) - ageMinutes(b.age),
    )
    .slice(0, 6);
}

/** Rough re-parse of "18h" / "2d" back to minutes, for sorting only. */
function ageMinutes(age: string): number {
  const n = parseInt(age, 10) || 0;
  if (age.endsWith("d")) return n * 1440;
  if (age.endsWith("h")) return n * 60;
  if (age.endsWith("m")) return n;
  return 0;
}
