import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { clearTodoLabel, fileTodoThread, GMAIL_TAG, trashThread } from "@/lib/google/gmail";
import { validMessageId } from "@/lib/llm/guard";
import { badId, rejectCrossSite } from "@/lib/request-guard";

/**
 * Finish a to-do email. Body: { action: "clear" } takes it off the to-do label, { action: "file",
 * label } files it there instead, { action: "trash" } trashes the conversation.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/clarify/thread/[id]">) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  if (!features.google) return NextResponse.json({ error: "Connect Google first." }, { status: 400 });
  const { id } = await ctx.params;
  if (!validMessageId(id)) return badId();

  const { action, label } = (await request.json().catch(() => ({}))) as { action?: unknown; label?: unknown };
  const name = typeof label === "string" ? label.trim() : "";
  if (action === "file" ? !name || name.length > 225 : action !== "clear" && action !== "trash") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  try {
    if (action === "clear") await clearTodoLabel(id);
    else if (action === "file") await fileTodoThread(id, name);
    else await trashThread(id);
    revalidateTag(GMAIL_TAG, { expire: 0 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
