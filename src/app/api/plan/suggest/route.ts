import { NextResponse } from "next/server";
import { guardAi } from "@/lib/llm/guard";
import { suggestSchedule } from "@/lib/llm/schedule";
import type { ScheduleGap, ScheduleTask } from "@/lib/llm/schedule-validate";

const MAX_TASKS = 25;
const MAX_GAPS = 10;

const num = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null;

/**
 * Propose where tasks fit in today's open gaps. Returns validated suggestions
 * only; nothing is written anywhere. Putting one on the calendar is a
 * separate, explicit click (POST /api/events).
 */
export async function POST(request: Request) {
  const blocked = guardAi(request, { spendsTokens: true });
  if (blocked) return blocked;

  const body = (await request.json().catch(() => null)) as {
    tasks?: unknown;
    gaps?: unknown;
    nowHour?: unknown;
  } | null;
  const nowHour = num(body?.nowHour, 0, 24);
  if (!body || nowHour === null || !Array.isArray(body.tasks) || !Array.isArray(body.gaps)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const gaps: ScheduleGap[] = [];
  for (const g of body.gaps.slice(0, MAX_GAPS)) {
    const s = num((g as ScheduleGap)?.start, 0, 24);
    const e = num((g as ScheduleGap)?.end, 0, 24);
    if (s !== null && e !== null && e > s) gaps.push({ start: s, end: e });
  }

  const tasks: ScheduleTask[] = [];
  for (const t of body.tasks.slice(0, MAX_TASKS)) {
    const r = t as Record<string, unknown>;
    const minutes = num(r?.minutes, 5, 240);
    const priority = r?.priority === 1 || r?.priority === 2 || r?.priority === 3 ? r.priority : null;
    if (typeof r?.id !== "string" || typeof r?.name !== "string" || minutes === null || priority === null) continue;
    tasks.push({
      id: r.id.slice(0, 64),
      name: r.name.slice(0, 120),
      priority,
      minutes,
      due: typeof r.due === "string" ? r.due.slice(0, 30) : "",
      overdueDays: num(r.overdueDays, 1, 3650) ?? undefined,
      deadline: typeof r.deadline === "string" ? r.deadline.slice(0, 10) : null,
    });
  }
  if (gaps.length === 0 || tasks.length === 0) return NextResponse.json({ suggestions: [] });

  try {
    return NextResponse.json({ suggestions: await suggestSchedule({ tasks, gaps, nowHour }) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
