import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { guardAi } from "@/lib/llm/guard";
import { RAMBLE_MAX_CHARS, rambleToTasks } from "@/lib/llm/ramble";
import { resolveLocation } from "@/lib/location";
import { listProjects } from "@/lib/tasks/todoist";
import { isoDateInZone } from "@/lib/time";

/** Ramble: a transcript → suggested tasks. Returns suggestions only; adding them is a separate click. */
export async function POST(request: Request) {
  const blocked = guardAi(request, { spendsTokens: true });
  if (blocked) return blocked;
  if (!features.todoist) return NextResponse.json({ error: "Set TODOIST_API_TOKEN to use Ramble." }, { status: 400 });

  const { text } = (await request.json().catch(() => ({}))) as { text?: unknown };
  if (typeof text !== "string" || !text.trim()) return NextResponse.json({ error: "Say or type something first." }, { status: 400 });
  if (text.length > RAMBLE_MAX_CHARS) return NextResponse.json({ error: "That's a long ramble. Try it in two goes." }, { status: 400 });

  try {
    const [projects, { timezone }] = await Promise.all([listProjects().catch(() => []), resolveLocation()]);
    const tasks = await rambleToTasks({ text, todayIso: isoDateInZone(new Date(), timezone), projects });
    if (!tasks.length) return NextResponse.json({ error: "Couldn't find any tasks in that. Try again?" }, { status: 422 });
    return NextResponse.json({ tasks });
  } catch (err) {
    // Messages are generic by construction (see lib/llm/client.ts).
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
