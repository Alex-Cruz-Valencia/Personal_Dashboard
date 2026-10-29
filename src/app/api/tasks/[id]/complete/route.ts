import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { completeTask, TODOIST_TAG } from "@/lib/tasks/todoist";
import { badId, rejectCrossSite, validTaskId } from "@/lib/request-guard";

/** Mark a task done. Undo with POST /api/tasks/[id]/reopen. */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/tasks/[id]/complete">,
) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  if (!features.todoist) {
    return NextResponse.json(
      { error: "Set TODOIST_API_TOKEN to complete tasks." },
      { status: 400 },
    );
  }
  const { id } = await ctx.params;
  if (!validTaskId(id)) return badId();

  try {
    await completeTask(id);
    revalidateTag(TODOIST_TAG, { expire: 0 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
