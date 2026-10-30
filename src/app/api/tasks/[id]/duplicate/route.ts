import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { duplicateTask, TODOIST_TAG } from "@/lib/tasks/todoist";
import { badId, rejectCrossSite, validTaskId } from "@/lib/request-guard";

/** Copy a task (same project, section, date and repeat, labels, priority, deadline, notes). */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/tasks/[id]/duplicate">,
) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  if (!features.todoist) {
    return NextResponse.json(
      { error: "Set TODOIST_API_TOKEN to duplicate tasks." },
      { status: 400 },
    );
  }
  const { id } = await ctx.params;
  if (!validTaskId(id)) return badId();

  try {
    const task = await duplicateTask(id);
    revalidateTag(TODOIST_TAG, { expire: 0 });
    return NextResponse.json({ ok: true, task }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
