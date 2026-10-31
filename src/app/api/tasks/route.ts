import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { addTask, TODOIST_TAG, type NewTask } from "@/lib/tasks/todoist";
import { rejectCrossSite, validTaskId } from "@/lib/request-guard";

/** Create a task. Body: { content, projectId?, sectionId?, parentId? (a subtask), priority? (1–3), due?, dueDate?, labels?, deadline?, durationMinutes?, description? }. */
export async function POST(request: Request) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  if (!features.todoist) {
    return NextResponse.json(
      { error: "Set TODOIST_API_TOKEN to add tasks." },
      { status: 400 },
    );
  }

  let body: NewTask;
  try {
    body = (await request.json()) as NewTask;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (body.priority !== undefined && ![1, 2, 3].includes(body.priority)) {
    return NextResponse.json({ error: "priority must be 1, 2 or 3" }, { status: 400 });
  }
  if (body.todoistPriority !== undefined && ![1, 2, 3, 4].includes(body.todoistPriority)) {
    return NextResponse.json({ error: "todoistPriority must be 1–4" }, { status: 400 });
  }

  if (body.dueDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) {
    return NextResponse.json({ error: "dueDate must be YYYY-MM-DD" }, { status: 400 });
  }
  if (body.description !== undefined && (typeof body.description !== "string" || body.description.length > 2000)) {
    return NextResponse.json({ error: "description is too long" }, { status: 400 });
  }

  const isIso = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (body.deadline !== undefined && !isIso(body.deadline)) {
    return NextResponse.json({ error: "deadline must be YYYY-MM-DD" }, { status: 400 });
  }
  if (
    body.durationMinutes !== undefined &&
    !(Number.isInteger(body.durationMinutes) && body.durationMinutes > 0 && body.durationMinutes <= 1440)
  ) {
    return NextResponse.json({ error: "durationMinutes must be 1–1440" }, { status: 400 });
  }
  if (body.due !== undefined && (typeof body.due !== "string" || body.due.length > 100)) {
    return NextResponse.json({ error: "due is too long" }, { status: 400 });
  }
  if (
    body.labels !== undefined &&
    !(Array.isArray(body.labels) && body.labels.length <= 20 && body.labels.every((l) => typeof l === "string" && l.length <= 60))
  ) {
    return NextResponse.json({ error: "labels must be a short list of names" }, { status: 400 });
  }
  if (body.parentId !== undefined && !(typeof body.parentId === "string" && validTaskId(body.parentId))) {
    return NextResponse.json({ error: "parentId must be a task id" }, { status: 400 });
  }
  if (body.sectionId !== undefined && !(typeof body.sectionId === "string" && validTaskId(body.sectionId))) {
    return NextResponse.json({ error: "sectionId must be an id" }, { status: 400 });
  }
  if (body.projectId !== undefined && typeof body.projectId !== "string") {
    return NextResponse.json({ error: "projectId must be a string" }, { status: 400 });
  }

  try {
    const task = await addTask({ ...body, content: body.content.trim() });
    revalidateTag(TODOIST_TAG, { expire: 0 });
    return NextResponse.json({ ok: true, task }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
