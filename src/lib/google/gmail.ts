/**
 * Phase 4 — the "Needs a reply" card via Gmail API v1.
 *
 * Goal: surface mail actually worth attention. Marketing / social / bulk
 * newsletters are dropped; genuine threads (a shared doc, a recruiter, an
 * "action required", a real person) are kept — read OR unread, because people
 * often read a message and reply later.
 *
 * Also lets a message be cleared from the card — trashed, or moved to a
 * label ("folder") — since a curated list is only useful if you can act on
 * it from here instead of switching to Gmail.
 */

import "server-only";
import { config } from "@/lib/config";
import { relativeAge } from "@/lib/time";
import type { ClarifyItem, Reply, Urgency } from "@/lib/types";
import { googleFetch } from "./tokens";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Cache tag on reply reads — mutations call `revalidateTag(GMAIL_TAG)`. */
export const GMAIL_TAG = "gmail";

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
const BOT_SENDER_RE = /\[bot\]/i;

/** Bulk / automated mail a human isn't expected to act on. */
function looksLikeBulk(msg: GmailMessage): boolean {
  const labels = msg.labelIds ?? [];
  const important = labels.includes("IMPORTANT");

  // Automation accounts ("vercel[bot]", "dependabot[bot]" — GitHub's naming
  // for app/bot users) never need a reply, even when Gmail flags them
  // important, which it does for notifications on your own repos.
  if (BOT_SENDER_RE.test(header(msg, "From"))) return true;

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
  const listUrl = new URL(`${BASE}/messages`);
  listUrl.searchParams.set("q", config.google.gmailQuery);
  listUrl.searchParams.set("maxResults", "40");

  const listRes = await googleFetch(listUrl, {
    next: { revalidate: 90, tags: [GMAIL_TAG] },
  });
  if (!listRes.ok) throw new Error(`Gmail list responded ${listRes.status}`);
  const list = (await listRes.json()) as GmailListResponse;
  const ids = (list.messages ?? []).map((m) => m.id);
  if (ids.length === 0) return [];

  const now = new Date();
  // One message that fails to load (deleted mid-request, a dropped connection)
  // drops out on its own instead of turning the whole list into sample mail.
  const settled = await Promise.allSettled(
    ids.map(async (id) => {
      const url = new URL(`${BASE}/messages/${id}`);
      url.searchParams.set("format", "metadata");
      for (const h of ["From", "Subject", "List-Unsubscribe", "Precedence"]) {
        url.searchParams.append("metadataHeaders", h);
      }
      const res = await googleFetch(url, {
        next: { revalidate: 90, tags: [GMAIL_TAG] },
      });
      if (!res.ok) throw new Error(`Gmail message ${id} responded ${res.status}`);
      return (await res.json()) as GmailMessage;
    }),
  );
  const messages = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (messages.length === 0) throw new Error("No Gmail message could be read");

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

/* ---------- clearing a message from the card ---------- */

interface GmailLabelEntry {
  id: string;
  name: string;
  type?: string;
  color?: { textColor?: string; backgroundColor?: string };
}

export interface GmailLabelInfo {
  name: string;
  /** Gmail's own color for this label, when the user set one. */
  textColor?: string;
  backgroundColor?: string;
}

async function fetchAllLabels(): Promise<GmailLabelEntry[]> {
  const res = await googleFetch(`${BASE}/labels`);
  if (!res.ok) throw new Error(`Gmail labels responded ${res.status}`);
  const data = (await res.json()) as { labels?: GmailLabelEntry[] };
  return data.labels ?? [];
}

/**
 * User-created labels only — the "folders" a message can be moved to —
 * with Gmail's own color for each, when the user set one.
 */
export async function listGmailLabels(): Promise<GmailLabelInfo[]> {
  const labels = await fetchAllLabels();
  return labels
    .filter((l) => l.type === "user")
    .map((l) => ({
      name: l.name,
      textColor: l.color?.textColor,
      backgroundColor: l.color?.backgroundColor,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Gmail needs a label id, not its name, to modify a message. */
async function findOrCreateLabelId(name: string): Promise<string> {
  const existing = (await fetchAllLabels()).find(
    (l) => l.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) return existing.id;

  const res = await googleFetch(`${BASE}/labels`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    }),
  });
  if (!res.ok) throw new Error(`Gmail label create responded ${res.status}`);
  const created = (await res.json()) as { id: string };
  return created.id;
}

/** Move to Trash — recoverable in Gmail for 30 days, same as clicking the trash icon there. */
export async function trashMessage(id: string): Promise<void> {
  const res = await googleFetch(`${BASE}/messages/${id}/trash`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Gmail trash responded ${res.status}`);
}

/**
 * The "move to a folder" action: apply a label (creating it if it doesn't
 * exist yet) and pull the message out of the inbox. Read/unread state is
 * left alone — same as Gmail's own move-to-label behavior.
 */
export async function moveMessageToLabel(id: string, labelName: string): Promise<void> {
  const labelId = await findOrCreateLabelId(labelName);
  const res = await googleFetch(`${BASE}/messages/${id}/modify`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ addLabelIds: [labelId], removeLabelIds: ["INBOX"] }),
  });
  if (!res.ok) throw new Error(`Gmail modify responded ${res.status}`);
}

/* ---------- reading one message and saving a reply draft ---------- */

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
  headers?: { name: string; value: string }[];
}

interface GmailFullMessage {
  id: string;
  threadId: string;
  payload?: GmailPart;
}

const b64urlDecode = (data: string) => Buffer.from(data, "base64url").toString("utf8");

/** First text/plain part, else the text/html part with tags stripped. */
function bodyText(part: GmailPart | undefined): string {
  if (!part) return "";
  const find = (p: GmailPart, type: string): string | null => {
    if (p.mimeType === type && p.body?.data) return b64urlDecode(p.body.data);
    for (const child of p.parts ?? []) {
      const hit = find(child, type);
      if (hit) return hit;
    }
    return null;
  };
  const plain = find(part, "text/plain");
  if (plain) return plain.trim();
  const html = find(part, "text/html");
  return html
    ? html.replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
    : "";
}

const headerOf = (part: GmailPart | undefined, name: string) =>
  part?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

async function getFull(id: string): Promise<GmailFullMessage> {
  const res = await googleFetch(`${BASE}/messages/${id}?format=full`);
  if (!res.ok) throw new Error(`Gmail message responded ${res.status}`);
  return (await res.json()) as GmailFullMessage;
}

/** What the reply drafter needs: who it's from, the subject and the text. */
export async function getMessageForDraft(
  id: string,
): Promise<{ from: string; subject: string; body: string }> {
  const msg = await getFull(id);
  return {
    from: headerOf(msg.payload, "From"),
    subject: headerOf(msg.payload, "Subject"),
    body: bodyText(msg.payload),
  };
}

const oneLine = (v: string) => v.replace(/[\r\n]+/g, " ").trim();
/** RFC 2047 for headers with non-ASCII characters. */
const mimeHeader = (v: string) =>
  /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=`;

/**
 * Save `text` as a threaded reply DRAFT to message `id`. Nothing is sent — the
 * draft sits in Gmail's Drafts until the user sends it. (`gmail.modify`
 * already covers creating drafts, so no new permission is needed.)
 */
export async function saveReplyDraft(id: string, text: string): Promise<{ url: string }> {
  const msg = await getFull(id);
  const to = oneLine(headerOf(msg.payload, "Reply-To") || headerOf(msg.payload, "From"));
  if (!to) throw new Error("The message has no sender to reply to.");
  const subjectRaw = oneLine(headerOf(msg.payload, "Subject"));
  const subject = /^re:/i.test(subjectRaw) ? subjectRaw : `Re: ${subjectRaw}`;
  const messageId = oneLine(headerOf(msg.payload, "Message-ID") || headerOf(msg.payload, "Message-Id"));
  const refs = oneLine(headerOf(msg.payload, "References"));

  const lines = [
    `To: ${to}`,
    `Subject: ${mimeHeader(subject)}`,
    ...(messageId ? [`In-Reply-To: ${messageId}`, `References: ${[refs, messageId].filter(Boolean).join(" ")}`] : []),
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    (Buffer.from(text, "utf8").toString("base64").match(/.{1,76}/g) ?? []).join("\r\n"),
  ];
  const raw = Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");

  const res = await googleFetch(`${BASE}/drafts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: { raw, threadId: msg.threadId } }),
  });
  if (!res.ok) throw new Error(`Gmail draft responded ${res.status}`);
  const created = (await res.json()) as { message?: { id?: string } };
  const draftMsg = created.message?.id;
  return { url: draftMsg ? `https://mail.google.com/mail/u/0/#drafts?compose=${draftMsg}` : "https://mail.google.com/mail/u/0/#drafts" };
}

/* ---------- the to-do label (Clarify mode) ---------- */

interface GmailThread {
  id: string;
  messages?: (GmailMessage & { snippet?: string })[];
}

/** The to-do label's id, or null when the account has no such label. */
async function todoLabelId(): Promise<string | null> {
  const wanted = config.google.todoLabel.toLowerCase();
  return (await fetchAllLabels()).find((l) => l.name.toLowerCase() === wanted)?.id ?? null;
}

/**
 * Threads under the to-do label. Threads, not messages: a label on two messages of one
 * conversation is one thing to clarify, and clearing it has to clear both.
 */
export async function getTodoThreads(): Promise<ClarifyItem[]> {
  const label = await todoLabelId();
  if (!label) return [];
  const listUrl = new URL(`${BASE}/threads`);
  listUrl.searchParams.set("labelIds", label);
  listUrl.searchParams.set("maxResults", "50");
  const listRes = await googleFetch(listUrl, { cache: "no-store" });
  if (!listRes.ok) throw new Error(`Gmail threads responded ${listRes.status}`);
  const ids = (((await listRes.json()) as { threads?: { id: string }[] }).threads ?? []).map((t) => t.id);

  const settled = await Promise.allSettled(
    ids.map(async (id) => {
      const url = new URL(`${BASE}/threads/${id}`);
      url.searchParams.set("format", "metadata");
      for (const h of ["From", "Subject"]) url.searchParams.append("metadataHeaders", h);
      const res = await googleFetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Gmail thread ${id} responded ${res.status}`);
      return (await res.json()) as GmailThread;
    }),
  );
  return settled.flatMap<ClarifyItem>((r) => {
    if (r.status !== "fulfilled") return [];
    const msg = r.value.messages?.filter((m) => m.labelIds?.includes(label)).at(-1);
    if (!msg) return [];
    return [
      {
        kind: "email",
        id: r.value.id,
        messageId: msg.id,
        title: header(msg, "Subject") || "(no subject)",
        from: displayName(header(msg, "From")),
        detail: msg.snippet,
        addedAt: Number(msg.internalDate),
      },
    ];
  });
}

/** How many threads wait under the to-do label; the page shows this on every render, so it's cached. */
export async function getTodoCount(): Promise<number> {
  const label = await todoLabelId();
  if (!label) return 0;
  const res = await googleFetch(`${BASE}/labels/${label}`, { next: { revalidate: 90, tags: [GMAIL_TAG] } });
  if (!res.ok) throw new Error(`Gmail label responded ${res.status}`);
  return ((await res.json()) as { threadsTotal?: number }).threadsTotal ?? 0;
}

async function modifyThread(id: string, change: { addLabelIds?: string[]; removeLabelIds?: string[] }): Promise<void> {
  const res = await googleFetch(`${BASE}/threads/${id}/modify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(change),
  });
  if (!res.ok) throw new Error(`Gmail modify responded ${res.status}`);
}

/** Clarified: the thread leaves the to-do label. Everything else about it stays as it was. */
export async function clearTodoLabel(id: string): Promise<void> {
  const label = await todoLabelId();
  if (label) await modifyThread(id, { removeLabelIds: [label] });
}

/** Filed: under `labelName` (created if new), out of the to-do label and out of the inbox. */
export async function fileTodoThread(id: string, labelName: string): Promise<void> {
  const [target, todo] = await Promise.all([findOrCreateLabelId(labelName), todoLabelId()]);
  await modifyThread(id, { addLabelIds: [target], removeLabelIds: [...(todo ? [todo] : []), "INBOX"] });
}

/** The whole conversation goes to Trash, recoverable in Gmail for 30 days. */
export async function trashThread(id: string): Promise<void> {
  const res = await googleFetch(`${BASE}/threads/${id}/trash`, { method: "POST" });
  if (!res.ok) throw new Error(`Gmail trash responded ${res.status}`);
}
