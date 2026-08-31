import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { completeTask, TODOIST_TAG } from "@/lib/tasks/todoist";

/** Mark a task done. Undo with POST /api/tasks/[id]/reopen. */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/tasks/[id]/complete">,
) {
  if (!features.todoist) {
    return NextResponse.json(
      { error: "Set TODOIST_API_TOKEN to complete tasks." },
      { status: 400 },
    );
  }
  const { id } = await ctx.params;

  try {
    await completeTask(id);
    revalidateTag(TODOIST_TAG, { expire: 0 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
