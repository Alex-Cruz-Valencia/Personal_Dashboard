import { NextResponse } from "next/server";
import { config, features, isDemoMode } from "@/lib/config";
import { isGoogleConnected } from "@/lib/google/tokens";

/** What's wired up — handy for a future settings screen. */
export async function GET() {
  return NextResponse.json({
    demoMode: isDemoMode,
    timezone: config.timezone,
    location: { latitude: config.latitude, longitude: config.longitude },
    integrations: {
      weather: { configured: features.weather, provider: "open-meteo" },
      todoist: { configured: features.todoist },
      google: {
        configured: features.google,
        connected: features.google ? await isGoogleConnected() : false,
      },
      anthropic: {
        configured: features.anthropic,
        model: features.anthropic ? config.anthropic.model : null,
      },
    },
  });
}
