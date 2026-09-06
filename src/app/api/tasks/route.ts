import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { addTask, TODOIST_TAG, type NewTask } from "@/lib/tasks/todoist";

/** Create a task. Body: { content, projectId?, priority? (1–3), due?, labels? }. */
export async function POST(request: Request) {
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

  try {
    const task = await addTask({ ...body, content: body.content.trim() });
    revalidateTag(TODOIST_TAG, { expire: 0 });
    return NextResponse.json({ ok: true, task }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
