import { NextResponse } from "next/server";
import { clearGoogleTokens } from "@/lib/google/tokens";

async function disconnect(origin: string) {
  await clearGoogleTokens();
  const home = new URL("/", origin);
  home.searchParams.set("google", "disconnected");
  return NextResponse.redirect(home);
}

export async function GET(request: Request) {
  return disconnect(new URL(request.url).origin);
}

export async function POST(request: Request) {
  return disconnect(new URL(request.url).origin);
}
