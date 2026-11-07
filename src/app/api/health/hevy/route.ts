import { NextResponse } from "next/server";
import { config, features } from "@/lib/config";
import { getHevyWorkoutCount, HevyError } from "@/lib/hevy/client";
import { rejectCrossSite } from "@/lib/request-guard";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

/** An on-demand read-only probe. It never returns the key or raw workout data. */
export async function GET(request: Request) {
  const blocked = rejectCrossSite(request, { allowDirect: true });
  if (blocked) return blocked;
  if (!config.hevy.apiKey) return NextResponse.json({ configured: false, connected: false, status: "not_configured", message: "Add HEVY_API_KEY to .env.local and restart the dev server." }, { headers });
  if (!features.hevy) return NextResponse.json({ configured: true, connected: false, status: "disabled", message: "Hevy is disabled while DASHBOARD_FORCE_MOCK is true." }, { headers });
  try {
    const workoutCount = await getHevyWorkoutCount();
    return NextResponse.json({ configured: true, connected: true, status: "connected", workoutCount, message: "Hevy API access works. Open Health to view your synced training data." }, { headers });
  } catch (error) {
    const code = error instanceof HevyError ? error.code : "unavailable";
    const messages: Record<string, string> = {
      authentication: "Hevy rejected the key. Check that the key is correct and your Hevy Pro access is active.",
      rate_limited: "Hevy is limiting requests. Wait a little, then try again.",
      invalid_response: "Hevy returned an unexpected response. Try again later.",
    };
    return NextResponse.json({ configured: true, connected: false, status: code, message: messages[code] ?? "Hevy is temporarily unavailable. Try again later." }, { status: code === "rate_limited" ? 429 : 502, headers });
  }
}
