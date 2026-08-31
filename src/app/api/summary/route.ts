import { NextResponse } from "next/server";
import { getDaySummary } from "@/lib/anthropic/summary";
import { config, features } from "@/lib/config";
import { getDashboardData } from "@/lib/dashboard-data";
import { deterministicDayNote } from "@/lib/day-note";
import type { AgendaEvent, Task, Weather } from "@/lib/types";

/**
 * Phase 5 — the daily summary note.
 *
 * GET  → regenerate the note from the current live dashboard data.
 * POST → generate a note from an explicit { nowHour, weather, tasks, agenda }
 *        body (used for previews / testing without touching real sources).
 */

export async function GET() {
  const data = await getDashboardData();
  return NextResponse.json({
    note: data.dayNote,
    source: data.sources.summary,
    model: features.anthropic ? config.anthropic.model : null,
  });
}

interface SummaryBody {
  userName?: string;
  nowHour: number;
  weather: Weather;
  tasks: Task[];
  agenda: AgendaEvent[];
}

export async function POST(request: Request) {
  let body: SummaryBody;
  try {
    body = (await request.json()) as SummaryBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.nowHour !== "number" || !Array.isArray(body.tasks)) {
    return NextResponse.json(
      { error: "Body must include nowHour, weather, tasks and agenda" },
      { status: 400 },
    );
  }

  if (!features.anthropic) {
    return NextResponse.json({
      note: deterministicDayNote(body.nowHour, body.tasks, body.agenda ?? []),
      source: "mock",
      model: null,
    });
  }

  try {
    const note = await getDaySummary({
      userName: body.userName ?? "there",
      nowHour: body.nowHour,
      weather: body.weather,
      tasks: body.tasks,
      agenda: body.agenda ?? [],
    });
    return NextResponse.json({ note, source: "live", model: config.anthropic.model });
  } catch (err) {
    return NextResponse.json(
      {
        note: deterministicDayNote(body.nowHour, body.tasks, body.agenda ?? []),
        source: "mock",
        error: (err as Error).message,
      },
      { status: 502 },
    );
  }
}
