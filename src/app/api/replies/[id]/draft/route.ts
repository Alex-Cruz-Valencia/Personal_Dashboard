import { NextResponse } from "next/server";
import { getMessageForDraft } from "@/lib/google/gmail";
import { guardAi, validMessageId } from "@/lib/llm/guard";
import { draftReply } from "@/lib/llm/draft";

/** Write a reply draft with the AI model. Returns text only; nothing is saved or sent. */
export async function POST(request: Request, ctx: RouteContext<"/api/replies/[id]/draft">) {
  const blocked = guardAi(request, { spendsTokens: true });
  if (blocked) return blocked;
  const { id } = await ctx.params;
  if (!validMessageId(id)) return NextResponse.json({ error: "Bad message id." }, { status: 400 });

  const payload = (await request.json().catch(() => ({}))) as { note?: unknown };
  const note = typeof payload.note === "string" ? payload.note : undefined;

  try {
    const msg = await getMessageForDraft(id);
    if (!msg.body) return NextResponse.json({ error: "That message has no text to reply to." }, { status: 422 });
    const text = await draftReply({ ...msg, note });
    return NextResponse.json({ text });
  } catch (err) {
    // The message is generic by construction (see lib/llm/client.ts).
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
