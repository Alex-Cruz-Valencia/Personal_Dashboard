import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { GMAIL_TAG, trashMessage } from "@/lib/google/gmail";
import { validMessageId } from "@/lib/llm/guard";
import { badId, rejectCrossSite } from "@/lib/request-guard";

/** Move a message to Trash — recoverable in Gmail for 30 days. */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/replies/[id]/trash">,
) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  if (!features.google) {
    return NextResponse.json(
      { error: "Connect Google to trash mail from here." },
      { status: 400 },
    );
  }
  const { id } = await ctx.params;
  if (!validMessageId(id)) return badId();

  try {
    await trashMessage(id);
    revalidateTag(GMAIL_TAG, { expire: 0 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
