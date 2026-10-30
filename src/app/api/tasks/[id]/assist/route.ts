import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { ASSIST_MODES, runAssist, type AssistMode } from "@/lib/llm/assist";
import { guardAi } from "@/lib/llm/guard";
import { badId, validTaskId } from "@/lib/request-guard";
import { getTaskForAssist } from "@/lib/tasks/todoist";

/**
 * Task Assist: a sharper title, subtasks, or tips for one task. Returns suggestions only;
 * applying one is a separate, ordinary task write the person clicks.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/tasks/[id]/assist">) {
  const blocked = guardAi(request, { spendsTokens: true });
  if (blocked) return blocked;
  if (!features.todoist) return NextResponse.json({ error: "Set TODOIST_API_TOKEN to use Task Assist." }, { status: 400 });
  const { id } = await ctx.params;
  if (!validTaskId(id)) return badId();

  const { mode } = (await request.json().catch(() => ({}))) as { mode?: unknown };
  if (!ASSIST_MODES.includes(mode as AssistMode)) {
    return NextResponse.json({ error: "mode must be actionable, breakdown or tips" }, { status: 400 });
  }

  try {
    const result = await runAssist(mode as AssistMode, await getTaskForAssist(id));
    if (!result) return NextResponse.json({ error: "Task Assist didn't come back with anything usable. Try again." }, { status: 502 });
    return NextResponse.json(result);
  } catch (err) {
    // Messages are generic by construction (see lib/llm/client.ts).
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
