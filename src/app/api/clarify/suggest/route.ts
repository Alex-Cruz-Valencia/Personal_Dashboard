import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { getMessageForDraft, listGmailLabels } from "@/lib/google/gmail";
import { clarifyItems, type ClarifyInput } from "@/lib/llm/clarify";
import { guardAi, validMessageId } from "@/lib/llm/guard";
import { resolveLocation } from "@/lib/location";
import { validTaskId } from "@/lib/request-guard";
import { getTaskForAssist, listProjects } from "@/lib/tasks/todoist";
import { isoDateInZone } from "@/lib/time";

/** One model call covers this many items, so a long queue stays well under the hourly cap. */
const MAX_ITEMS = 6;

interface Asked {
  kind?: unknown;
  id?: unknown;
  messageId?: unknown;
}

const validAsked = (a: Asked) =>
  typeof a.id === "string" &&
  (a.kind === "task" ? validTaskId(a.id) : a.kind === "email" && validMessageId(a.id) && typeof a.messageId === "string" && validMessageId(a.messageId));

/** Suggest what each item is and fill in its form. Read-only: every write is a later click. */
export async function POST(request: Request) {
  const blocked = guardAi(request, { spendsTokens: true });
  if (blocked) return blocked;

  const payload = (await request.json().catch(() => ({}))) as { items?: unknown };
  const asked = Array.isArray(payload.items) ? (payload.items as Asked[]) : [];
  if (asked.length === 0 || asked.length > MAX_ITEMS || !asked.every(validAsked)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  try {
    const [settled, projects, labels, { timezone }] = await Promise.all([
      Promise.allSettled(
        asked.map(async (a): Promise<ClarifyInput> => {
          const id = a.id as string;
          if (a.kind === "task") {
            const t = await getTaskForAssist(id);
            return { id, kind: "task", title: t.content, body: t.description ?? "" };
          }
          const m = await getMessageForDraft(a.messageId as string);
          return { id, kind: "email", title: m.subject, body: m.body, from: m.from };
        }),
      ),
      features.todoist ? listProjects().catch(() => []) : [],
      listGmailLabels().then((ls) => ls.map((l) => l.name)).catch(() => [] as string[]),
      resolveLocation(),
    ]);
    // One item that can't be read just gets no suggestion.
    const items = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const suggestions = await clarifyItems({ items, projects, labels, todayIso: isoDateInZone(new Date(), timezone) });
    return NextResponse.json({ suggestions });
  } catch (err) {
    // The message is generic by construction (see lib/llm/client.ts).
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
