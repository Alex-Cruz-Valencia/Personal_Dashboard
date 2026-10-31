import { NextResponse } from "next/server";
import { config, features } from "@/lib/config";
import { getTodoThreads } from "@/lib/google/gmail";
import { resolveLocation } from "@/lib/location";
import { getInboxTasks } from "@/lib/tasks/todoist";
import { isoDateInZone } from "@/lib/time";
import type { ClarifyItem } from "@/lib/types";

/**
 * What's waiting to be clarified: Inbox tasks and threads under the to-do label. Anything urgent
 * or already due comes first, then oldest first, so what's been sitting longest gets its turn.
 */
export async function GET() {
  const { timezone } = await resolveLocation();
  const todayIso = isoDateInZone(new Date(), timezone);
  const [tasks, emails] = await Promise.allSettled([
    features.todoist ? getInboxTasks(timezone) : Promise.resolve([]),
    features.google ? getTodoThreads() : Promise.resolve([]),
  ]);
  const pressing = (i: ClarifyItem) => i.priority === 1 || Boolean(i.dueDate && i.dueDate <= todayIso);
  const items = [tasks, emails]
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .sort((a, b) => Number(pressing(b)) - Number(pressing(a)) || a.addedAt - b.addedAt);
  return NextResponse.json({
    items,
    todayIso,
    todoLabel: config.google.todoLabel,
    partial: tasks.status === "rejected" || emails.status === "rejected",
  });
}
