import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { badId, rejectCrossSite, validTaskId } from "@/lib/request-guard";
import { resolveLocation } from "@/lib/location";
import {
  deleteTask,
  moveTask,
  rescheduleTask,
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
  /** Move the task to this section (its project comes with it). */
  sectionId?: string;
  /**
   * Move the task to this day ("YYYY-MM-DD"), keeping its time and repeat, or null for no
   * date. The task menu's date shortcuts use this; `due` replaces the whole due instead.
   */
  date?: string | null;
}

/**
 * Edit a task. Accepts any of: content, description, priority (1–3),
 * due (natural language / null), labels, deadline (ISO date / null),
 * durationMinutes (number / null), projectId / sectionId (move),
 * todoistPriority (1–4), date (reschedule, ISO date / null).
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/tasks/[id]">,
) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  if (!features.todoist) return notConfigured();
  const { id } = await ctx.params;
  if (!validTaskId(id)) return badId();

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

  // Same limits as creating a task (POST /api/tasks), so a bad value is a
  // clear 400 here rather than a vague Todoist error.
  const isIso = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const problem =
    (body.content !== undefined && !(typeof body.content === "string" && body.content.trim() && body.content.length <= 500) && "content must be non-empty text") ||
    (body.description !== undefined && !(typeof body.description === "string" && body.description.length <= 2000) && "description is too long") ||
    (body.due !== undefined && body.due !== null && !(typeof body.due === "string" && body.due.length <= 100) && "due is too long") ||
    (body.deadline !== undefined && body.deadline !== null && !isIso(body.deadline) && "deadline must be YYYY-MM-DD") ||
    (body.durationMinutes !== undefined && body.durationMinutes !== null &&
      !(Number.isInteger(body.durationMinutes) && body.durationMinutes > 0 && body.durationMinutes <= 1440) && "durationMinutes must be 1–1440") ||
    (body.labels !== undefined &&
      !(Array.isArray(body.labels) && body.labels.length <= 20 && body.labels.every((l) => typeof l === "string" && l.length <= 60)) && "labels must be a short list of names") ||
    (body.projectId !== undefined && typeof body.projectId !== "string" && "projectId must be a string") ||
    (body.sectionId !== undefined && !(typeof body.sectionId === "string" && validTaskId(body.sectionId)) && "sectionId must be an id") ||
    (body.todoistPriority !== undefined && ![1, 2, 3, 4].includes(body.todoistPriority) && "todoistPriority must be 1–4") ||
    (body.date !== undefined && body.date !== null && !isIso(body.date) && "date must be YYYY-MM-DD");
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const { projectId, sectionId, date, ...patch } = body;
  if (patch.content !== undefined) patch.content = patch.content.trim();

  try {
    // Todoist keeps "move" separate from "update" — do the move first.
    if (projectId || sectionId) await moveTask(id, { projectId, sectionId });
    if (date !== undefined) await rescheduleTask(id, date, (await resolveLocation()).timezone);
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
  request: Request,
  ctx: RouteContext<"/api/tasks/[id]">,
) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  if (!features.todoist) return notConfigured();
  const { id } = await ctx.params;
  if (!validTaskId(id)) return badId();

  try {
    await deleteTask(id);
    revalidateTag(TODOIST_TAG, { expire: 0 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
