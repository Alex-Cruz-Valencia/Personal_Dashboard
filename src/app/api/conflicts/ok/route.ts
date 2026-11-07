import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { addOkConflict } from "@/lib/conflict-ok-store";
import { rejectCrossSite } from "@/lib/request-guard";

/**
 * "It's fine" on a conflict or tight turnaround, remembered for every device.
 * Only a private deployment (Google connected) has a store; the public demo
 * fails closed and keeps the choice in the browser alone.
 */
export async function POST(request: Request) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  if (!features.google) return NextResponse.json({ error: "Not available." }, { status: 400 });
  let body: { key?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.key !== "string") return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  try {
    if (!(await addOkConflict(body.key))) return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Couldn't save." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
