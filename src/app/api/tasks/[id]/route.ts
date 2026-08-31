import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import {
  deleteTask,
  TODOIST_TAG,
  updateTask,
  type TaskPatch,
} from "@/lib/tasks/todoist";

function notConfigured() {
  return NextResponse.json(
    { error: "Set TODOIST_API_TOKEN to edit tasks." },
    { status: 400 },
  );
}

/** Edit a task's text, priority, due date or labels. */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/tasks/[id]">,
) {
  if (!features.todoist) return notConfigured();
  const { id } = await ctx.params;

  let patch: TaskPatch;
  try {
    patch = (await request.json()) as TaskPatch;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (patch.priority !== undefined && ![1, 2, 3].includes(patch.priority)) {
    return NextResponse.json(
      { error: "priority must be 1 (urgent), 2 (normal) or 3 (someday)" },
      { status: 400 },
    );
  }

  try {
    const task = await updateTask(id, patch);
    revalidateTag(TODOIST_TAG, { expire: 0 });
    return NextResponse.json({ ok: true, task });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }
}

/** Delete a task. No UI triggers this — it's here for API completeness. */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/tasks/[id]">,
) {
  if (!features.todoist) return notConfigured();
  const { id } = await ctx.params;

  try {
    await deleteTask(id);
    revalidateTag(TODOIST_TAG, { expire: 0 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }
}
