import { NextResponse } from "next/server";
import { config, features, isDemoMode } from "@/lib/config";
import { isGoogleConnected } from "@/lib/google/tokens";
import { resolveLocation } from "@/lib/location";

/** What's wired up — handy for a future settings screen. */
export async function GET() {
  const location = await resolveLocation();
  return NextResponse.json({
    demoMode: isDemoMode,
    location,
    integrations: {
      weather: { configured: features.weather, provider: "open-meteo" },
      todoist: { configured: features.todoist },
      hevy: { configured: Boolean(config.hevy.apiKey), enabled: features.hevy },
      fatsecret: {
        configured: Boolean(config.fatsecret.clientId && config.fatsecret.clientSecret),
        enabled: features.fatsecret,
        diaryConnected: false,
      },
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
