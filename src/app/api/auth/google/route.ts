import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { getAuthUrl } from "@/lib/google/oauth";

export const STATE_COOKIE = "gdash_oauth_state";

/** Kick off the Google OAuth consent flow. */
export async function GET() {
  if (!features.google) {
    return NextResponse.json(
      { error: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to connect Google." },
      { status: 400 },
    );
  }

  const state = randomBytes(16).toString("hex");
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(getAuthUrl(state));
}
