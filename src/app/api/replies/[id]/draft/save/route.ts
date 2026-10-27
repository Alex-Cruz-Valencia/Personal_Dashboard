import { NextResponse } from "next/server";
import { saveReplyDraft } from "@/lib/google/gmail";
import { guardAi, validMessageId } from "@/lib/llm/guard";

const MAX_TEXT = 8_000;

/** Save the (edited) text as a threaded Gmail DRAFT. Never sends. */
export async function POST(request: Request, ctx: RouteContext<"/api/replies/[id]/draft/save">) {
  const blocked = guardAi(request, { spendsTokens: false });
  if (blocked) return blocked;
  const { id } = await ctx.params;
  if (!validMessageId(id)) return NextResponse.json({ error: "Bad message id." }, { status: 400 });

  const payload = (await request.json().catch(() => ({}))) as { text?: unknown };
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!text || text.length > MAX_TEXT) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });

  try {
    return NextResponse.json(await saveReplyDraft(id, text));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
