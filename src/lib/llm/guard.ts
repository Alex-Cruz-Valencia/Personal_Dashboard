import "server-only";
import { NextResponse } from "next/server";
import { features } from "@/lib/config";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const hits: number[] = [];

/** Message ids are Gmail's hex ids; anything else never reaches a URL. */
export const validMessageId = (id: string) => /^[A-Za-z0-9_-]{6,64}$/.test(id);

/**
 * Shared checks for the AI routes. Returns a response to send back when a
 * check fails, or null when the request may proceed.
 * - needs both the AI model and Google configured (a deployment with neither,
 *   like the public demo, fails closed);
 * - same-origin only, so another website can't make your browser spend tokens;
 * - a simple hourly cap, in case something loops.
 */
export function guardAi(request: Request, opts: { spendsTokens: boolean }): NextResponse | null {
  if (!features.llm || !features.google) {
    return NextResponse.json({ error: "AI drafting isn't set up." }, { status: 400 });
  }
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  if (opts.spendsTokens) {
    const now = Date.now();
    while (hits.length && hits[0] < now - WINDOW_MS) hits.shift();
    if (hits.length >= MAX_PER_WINDOW) {
      return NextResponse.json({ error: "Too many drafts this hour. Try again later." }, { status: 429 });
    }
    hits.push(now);
  }
  return null;
}
