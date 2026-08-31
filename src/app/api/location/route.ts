import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  LOCATION_COOKIE,
  resolveLocation,
  serializeStoredLocation,
  validLatLon,
} from "@/lib/location";

const MAX_AGE = 60 * 60 * 24 * 90; // 90 days

/** Current resolved location. */
export async function GET() {
  return NextResponse.json(await resolveLocation());
}

/** Store the device's position (called by the `LocationSync` client component). */
export async function POST(request: Request) {
  let body: {
    latitude?: unknown;
    longitude?: unknown;
    timezone?: unknown;
    label?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!validLatLon(body.latitude, body.longitude)) {
    return NextResponse.json(
      { error: "latitude/longitude out of range" },
      { status: 400 },
    );
  }

  const value = serializeStoredLocation({
    latitude: body.latitude,
    longitude: body.longitude as number,
    timezone: typeof body.timezone === "string" ? body.timezone : undefined,
    label: typeof body.label === "string" ? body.label : undefined,
  });

  (await cookies()).set(LOCATION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });

  return NextResponse.json({ ok: true, location: await resolveLocation() });
}

/** Forget the stored device location (fall back to env / default). */
export async function DELETE() {
  (await cookies()).delete(LOCATION_COOKIE);
  return NextResponse.json({ ok: true });
}
