import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { reopenTask, TODOIST_TAG } from "@/lib/tasks/todoist";

/** Un-complete a task. */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/tasks/[id]/reopen">,
) {
  if (!features.todoist) {
    return NextResponse.json(
      { error: "Set TODOIST_API_TOKEN to reopen tasks." },
      { status: 400 },
    );
  }
  const { id } = await ctx.params;

  try {
    await reopenTask(id);
    revalidateTag(TODOIST_TAG, { expire: 0 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
