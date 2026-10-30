import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { listLabels, listProjects, listSections } from "@/lib/tasks/todoist";

/** Projects, sections and labels for the task editor and menu. Fetched lazily when a task opens. */
export async function GET() {
  if (!features.todoist) {
    return NextResponse.json({ projects: [], sections: [], labels: [] });
  }
  try {
    const [projects, sections, labels] = await Promise.all([
      listProjects(),
      listSections().catch(() => []),
      listLabels().catch(() => [] as string[]),
    ]);
    return NextResponse.json({ projects, sections, labels });
  } catch (err) {
    return NextResponse.json(
      { projects: [], sections: [], labels: [], error: (err as Error).message },
      { status: 502 },
    );
  }
}
