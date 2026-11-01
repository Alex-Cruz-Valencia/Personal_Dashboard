import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { clearTodoLabel, fileTodoThread, GMAIL_TAG, restoreTodoThread, trashThread, untrashThread } from "@/lib/google/gmail";
import { validMessageId } from "@/lib/llm/guard";
import { badId, rejectCrossSite } from "@/lib/request-guard";

/**
 * Finish a to-do email. Body: { action: "clear" } takes it off the to-do label, { action: "file",
 * label } files it there instead, { action: "trash" } trashes the conversation.
 * { action: "untrash" } and { action: "restore", label?, inbox? } take those back.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/clarify/thread/[id]">) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  if (!features.google) return NextResponse.json({ error: "Connect Google first." }, { status: 400 });
  const { id } = await ctx.params;
  if (!validMessageId(id)) return badId();

  const { action, label, inbox } = (await request.json().catch(() => ({}))) as { action?: unknown; label?: unknown; inbox?: unknown };
  const name = typeof label === "string" ? label.trim() : "";
  if (action === "file" ? !name || name.length > 225 : !["clear", "trash", "untrash", "restore"].includes(action as string)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  try {
    let wasInbox: boolean | undefined;
    if (action === "clear") await clearTodoLabel(id);
    else if (action === "file") wasInbox = await fileTodoThread(id, name);
    else if (action === "untrash") await untrashThread(id);
    else if (action === "restore") await restoreTodoThread(id, name || undefined, inbox === true);
    else await trashThread(id);
    revalidateTag(GMAIL_TAG, { expire: 0 });
    return NextResponse.json({ ok: true, inbox: wasInbox });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
