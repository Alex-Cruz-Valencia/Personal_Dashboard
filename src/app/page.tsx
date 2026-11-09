import { cookies } from "next/headers";
import { after } from "next/server";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Dashboard } from "@/components/Dashboard";
import { LocationSync } from "@/components/LocationSync";
import { config, features } from "@/lib/config";
import { getDashboardData } from "@/lib/dashboard-data";
import { fillTriage } from "@/lib/llm/background-triage";
import { DAY_PARTS, partHour } from "@/lib/day-part";
import { parseLocationOverride } from "@/lib/location";
import { parseSkyPreview } from "@/lib/weather/codes";
import { PREFS_COOKIE, parseSettings, readStoredSettings } from "@/lib/settings";

// Always render per-request: "now", weather and mail all move through the day.
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const [sp, cookieStore] = await Promise.all([searchParams, cookies()]);
  // Precedence: URL query → dashboard_prefs cookie → this deployment's env
  // config → settings.ts's own hardcoded fallback.
  const settings = parseSettings(sp, {
    dayStart: config.arcFrom,
    dayEnd: config.arcTo,
    weatherStart: config.arcFrom,
    ...readStoredSettings(cookieStore.get(PREFS_COOKIE)?.value),
  });
  const data = await getDashboardData(parseLocationOverride(sp), {
    dayStart: settings.dayStart,
    dayEnd: settings.dayEnd,
    weatherStart: settings.weatherStart,
  }, {
    noteStyle: settings.noteStyle,
    use24: settings.timeFormat === "24-hour",
    windDown: settings.windDown,
  });
  // Once the page is out: triage any email or Waiting on thread not looked at yet, so the queue opens
  // already filled in. Only when this render has real mail (`email` live) and something is missing.
  if (data.sources.email === "live") {
    const fresh = data.replies.filter((r) => r.id && !(r.id in data.triage));
    const freshWaiting = data.waiting.filter((w) => !(w.id in data.nudges));
    if (fresh.length || freshWaiting.length) after(() => fillTriage(fresh, freshWaiting));
  }
  const sky = parseSkyPreview(sp) ?? (settings.skyWeather === "auto" ? null : { ...data.weather.sky, kind: settings.skyWeather });
  // Preview only: ?now=14.5 shows the page as if it were 2:30pm (greeting, scenes, curve), and ?part=golden
  // jumps to that part of today's real sun. The live clock still runs.
  const part = DAY_PARTS.find((p) => p === sp.part);
  const previewNow = part ? partHour(part, data.weather) : Number(typeof sp.now === "string" ? sp.now : NaN);
  const shown = Number.isFinite(previewNow) && previewNow >= 0 && previewNow < 24 ? { ...data, today: { ...data.today, nowHour: previewNow } } : data;
  return (
    <>
      <Dashboard
        data={sky ? { ...shown, weather: { ...shown.weather, sky } } : shown}
        settings={settings}
        connectFailed={typeof sp.google === "string" && sp.google.startsWith("error:")}
      />
      {/* The public demo has nothing to localize, so it doesn't ask for your position. */}
      {features.google || features.todoist ? <LocationSync /> : null}
      <AutoRefresh />
    </>
  );
}
