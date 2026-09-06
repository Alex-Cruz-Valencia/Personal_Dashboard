import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import {
  deleteTask,
  moveTask,
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

interface PatchBody extends TaskPatch {
  /** Move the task to this project. */
  projectId?: string;
}

/**
 * Edit a task. Accepts any of: content, description, priority (1–3),
 * due (natural language / null), labels, deadline (ISO date / null),
 * durationMinutes (number / null), projectId (move).
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/tasks/[id]">,
) {
  if (!features.todoist) return notConfigured();
  const { id } = await ctx.params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.priority !== undefined && ![1, 2, 3].includes(body.priority)) {
    return NextResponse.json(
      { error: "priority must be 1 (urgent), 2 (normal) or 3 (someday)" },
      { status: 400 },
    );
  }

  const { projectId, ...patch } = body;

  try {
    // Todoist keeps "move" separate from "update" — do the move first.
    if (projectId) await moveTask(id, projectId);
    const hasPatch = Object.values(patch).some((v) => v !== undefined);
    const task = hasPatch ? await updateTask(id, patch) : null;
    revalidateTag(TODOIST_TAG, { expire: 0 });
    return NextResponse.json({ ok: true, task });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

/** Delete a task. */
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
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
