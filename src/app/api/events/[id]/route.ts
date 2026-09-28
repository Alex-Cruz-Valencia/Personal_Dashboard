import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { CALENDAR_TAG, deleteEvent, updateEvent, type EventPatch } from "@/lib/google/calendar";
import { resolveLocation } from "@/lib/location";

function notConfigured() {
  return NextResponse.json(
    { error: "Connect Google to edit calendar events from here." },
    { status: 400 },
  );
}

interface PatchBody {
  name?: string;
  location?: string;
  description?: string;
  /** Rescheduling: send both together, "YYYY-MM-DD" and "HH:MM" (24-hour). */
  date?: string;
  startTime?: string;
  endTime?: string;
}

/**
 * Edit an event. Any of: name, location, description, or a reschedule via
 * date + startTime + endTime (all three together — the viewer's own
 * timezone is resolved server-side, same as the rest of the dashboard).
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/events/[id]">,
) {
  if (!features.google) return notConfigured();
  const { id } = await ctx.params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: EventPatch = {};
  if (body.name !== undefined) patch.summary = body.name.trim();
  if (body.location !== undefined) patch.location = body.location.trim();
  if (body.description !== undefined) patch.description = body.description.trim();

  if (body.date || body.startTime || body.endTime) {
    if (!body.date || !body.startTime || !body.endTime) {
      return NextResponse.json(
        { error: "Rescheduling needs date, startTime and endTime together" },
        { status: 400 },
      );
    }
    if (body.endTime <= body.startTime) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }
    const { timezone } = await resolveLocation();
    patch.start = { date: body.date, time: body.startTime, timeZone: timezone };
    patch.end = { date: body.date, time: body.endTime, timeZone: timezone };
  }

  try {
    await updateEvent(id, patch);
    revalidateTag(CALENDAR_TAG, { expire: 0 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/events/[id]">,
) {
  if (!features.google) return notConfigured();
  const { id } = await ctx.params;

  try {
    await deleteEvent(id);
    revalidateTag(CALENDAR_TAG, { expire: 0 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
