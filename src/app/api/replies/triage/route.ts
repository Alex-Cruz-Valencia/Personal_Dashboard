import { NextResponse } from "next/server";
import { getMessageForDraft, listGmailLabels } from "@/lib/google/gmail";
import { readEmailProfile } from "@/lib/llm/email-profile";
import { guardAi, validMessageId } from "@/lib/llm/guard";
import { triageEmails } from "@/lib/llm/triage";

/** The reply queue never shows more than this many emails at once. */
const MAX_IDS = 8;

/**
 * Suggest one action per email (trash, task, reply, file, leave). Read-only:
 * returns suggestions, and each is applied only by a click on the existing
 * trash / move / task / draft routes.
 */
export async function POST(request: Request) {
  const blocked = guardAi(request, { spendsTokens: true });
  if (blocked) return blocked;

  const payload = (await request.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(payload.ids) ? [...new Set(payload.ids)] : [];
  if (ids.length === 0 || ids.length > MAX_IDS || !ids.every((id) => typeof id === "string" && validMessageId(id))) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  try {
    const [settled, labels, profile] = await Promise.all([
      Promise.allSettled((ids as string[]).map(async (id) => ({ id, ...(await getMessageForDraft(id)) }))),
      listGmailLabels().then((ls) => ls.map((l) => l.name)),
      readEmailProfile(),
    ]);
    // One message that can't be read just gets no suggestion.
    const emails = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const suggestions = await triageEmails(emails, labels, profile);
    return NextResponse.json({ suggestions });
  } catch (err) {
    // The message is generic by construction (see lib/llm/client.ts).
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
