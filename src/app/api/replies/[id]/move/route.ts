import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { GMAIL_TAG, moveMessageToLabel } from "@/lib/google/gmail";

/** Move a message to a label ("folder"), out of the inbox. Body: { label }. */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/replies/[id]/move">,
) {
  if (!features.google) {
    return NextResponse.json(
      { error: "Connect Google to move mail from here." },
      { status: 400 },
    );
  }
  const { id } = await ctx.params;

  let body: { label?: string };
  try {
    body = (await request.json()) as { label?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const label = body.label?.trim();
  if (!label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  try {
    await moveMessageToLabel(id, label);
    revalidateTag(GMAIL_TAG, { expire: 0 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
