import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { CALENDAR_TAG, deleteEvent, updateEvent, type EventPatch } from "@/lib/google/calendar";
import { resolveLocation } from "@/lib/location";
import { rejectCrossSite } from "@/lib/request-guard";

function notConfigured() {
  return NextResponse.json(
    { error: "Connect Google to edit calendar events from here." },
    { status: 400 },
  );
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

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
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  if (!features.google) return notConfigured();
  const { id } = await ctx.params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = (v: unknown, max: number) => v === undefined || (typeof v === "string" && v.length <= max);
  if (!text(body.name, 1000) || !text(body.location, 1000) || !text(body.description, 8000)) {
    return NextResponse.json({ error: "name, location and description must be short text" }, { status: 400 });
  }
  const patch: EventPatch = {};
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "The event needs a name" }, { status: 400 });
    patch.summary = name;
  }
  if (body.location !== undefined) patch.location = body.location.trim();
  if (body.description !== undefined) patch.description = body.description.trim();

  if (body.date || body.startTime || body.endTime) {
    if (!body.date || !body.startTime || !body.endTime) {
      return NextResponse.json(
        { error: "Rescheduling needs date, startTime and endTime together" },
        { status: 400 },
      );
    }
    if (!DATE.test(body.date) || !TIME.test(body.startTime) || !TIME.test(body.endTime)) {
      return NextResponse.json(
        { error: "date must be YYYY-MM-DD and times HH:MM" },
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
  request: Request,
  ctx: RouteContext<"/api/events/[id]">,
) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
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
