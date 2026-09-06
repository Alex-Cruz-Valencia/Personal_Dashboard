import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { listLabels, listProjects } from "@/lib/tasks/todoist";

/** Projects + labels for the task editor. Fetched lazily when a task opens. */
export async function GET() {
  if (!features.todoist) {
    return NextResponse.json({ projects: [], labels: [] });
  }
  try {
    const [projects, labels] = await Promise.all([
      listProjects(),
      listLabels().catch(() => [] as string[]),
    ]);
    return NextResponse.json({ projects, labels });
  } catch (err) {
    return NextResponse.json(
      { projects: [], labels: [], error: (err as Error).message },
      { status: 502 },
    );
  }
}
