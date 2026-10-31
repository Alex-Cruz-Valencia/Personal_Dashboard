import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { getMessageForDraft } from "@/lib/google/gmail";
import { validMessageId } from "@/lib/llm/guard";
import { badId } from "@/lib/request-guard";

const MAX_CHARS = 10_000;

/** The email's text, loaded when Clarify reaches it. */
export async function GET(_request: Request, ctx: RouteContext<"/api/clarify/message/[id]">) {
  if (!features.google) return NextResponse.json({ error: "Connect Google first." }, { status: 400 });
  const { id } = await ctx.params;
  if (!validMessageId(id)) return badId();
  try {
    const { body } = await getMessageForDraft(id);
    return NextResponse.json({ body: body.slice(0, MAX_CHARS) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
