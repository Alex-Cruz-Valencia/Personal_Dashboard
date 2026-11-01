import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { GMAIL_TAG, unmoveMessage, untrashMessage } from "@/lib/google/gmail";
import { validMessageId } from "@/lib/llm/guard";
import { badId, rejectCrossSite } from "@/lib/request-guard";

/** Undo a trash, or with { label } undo a move to that label. */
export async function POST(request: Request, ctx: RouteContext<"/api/replies/[id]/restore">) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  if (!features.google) return NextResponse.json({ error: "Connect Google first." }, { status: 400 });
  const { id } = await ctx.params;
  if (!validMessageId(id)) return badId();

  const { label } = (await request.json().catch(() => ({}))) as { label?: unknown };
  try {
    if (typeof label === "string" && label.trim()) await unmoveMessage(id, label.trim());
    else await untrashMessage(id);
    revalidateTag(GMAIL_TAG, { expire: 0 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
