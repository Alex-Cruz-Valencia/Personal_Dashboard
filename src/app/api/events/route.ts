import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { CALENDAR_TAG, createEvent } from "@/lib/google/calendar";
import { resolveLocation } from "@/lib/location";
import { taskMarker } from "@/lib/plan";

interface PostBody {
  name?: string;
  /** "YYYY-MM-DD" */
  date?: string;
  /** "HH:MM", 24-hour */
  startTime?: string;
  endTime?: string;
  /** When blocking a Todoist task — tagged in the description so the Plan card skips it next time. */
  taskId?: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

/**
 * Create an event on the primary calendar, in the viewer's own timezone.
 * Body: { name, date, startTime, endTime, taskId? }.
 */
export async function POST(request: Request) {
  if (!features.google) {
    return NextResponse.json(
      { error: "Connect Google to add calendar events from here." },
      { status: 400 },
    );
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!body.date || !DATE.test(body.date) || !body.startTime || !TIME.test(body.startTime) || !body.endTime || !TIME.test(body.endTime)) {
    return NextResponse.json(
      { error: "date (YYYY-MM-DD), startTime and endTime (HH:MM) are required" },
      { status: 400 },
    );
  }
  if (body.endTime <= body.startTime) {
    return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
  }

  const { timezone } = await resolveLocation();
  const description = body.taskId
    ? `Planned from the dashboard for a Todoist task. ${taskMarker(body.taskId)}`
    : undefined;

  try {
    const id = await createEvent({
      summary: name,
      description,
      start: { date: body.date, time: body.startTime, timeZone: timezone },
      end: { date: body.date, time: body.endTime, timeZone: timezone },
    });
    revalidateTag(CALENDAR_TAG, { expire: 0 });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
