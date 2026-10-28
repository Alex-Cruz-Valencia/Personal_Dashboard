import { NextResponse } from "next/server";
import { getMessageForDraft } from "@/lib/google/gmail";
import { guardAi, validMessageId } from "@/lib/llm/guard";
import { suggestTask } from "@/lib/llm/task";

/**
 * Propose a task from an email with the AI model. Returns fields only; nothing
 * is written. Adding the task is a separate, explicit click (POST /api/tasks).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/replies/[id]/task">) {
  const blocked = guardAi(request, { spendsTokens: true });
  if (blocked) return blocked;
  const { id } = await ctx.params;
  if (!validMessageId(id)) return NextResponse.json({ error: "Bad message id." }, { status: 400 });

  const payload = (await request.json().catch(() => ({}))) as { today?: unknown };
  const today = typeof payload.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.today) ? payload.today : null;
  if (!today) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  try {
    const msg = await getMessageForDraft(id);
    if (!msg.body) return NextResponse.json({ error: "That message has no text to read." }, { status: 422 });
    const suggestion = await suggestTask({ ...msg, todayIso: today });
    if (!suggestion) return NextResponse.json({ error: "Couldn't read a task from that." }, { status: 502 });
    return NextResponse.json({ suggestion });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
