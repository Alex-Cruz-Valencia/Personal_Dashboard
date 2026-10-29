import { NextResponse } from "next/server";
import { clearGoogleTokens } from "@/lib/google/tokens";
import { rejectCrossSite } from "@/lib/request-guard";

async function disconnect(origin: string) {
  await clearGoogleTokens();
  const home = new URL("/", origin);
  home.searchParams.set("google", "disconnected");
  return NextResponse.redirect(home);
}

// GET stays so the README's "visit /api/auth/google/logout" works from the
// address bar, but a link or image on another site can't disconnect you.
export async function GET(request: Request) {
  const blocked = rejectCrossSite(request, { allowDirect: true });
  if (blocked) return blocked;
  return disconnect(new URL(request.url).origin);
}

export async function POST(request: Request) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  return disconnect(new URL(request.url).origin);
}
