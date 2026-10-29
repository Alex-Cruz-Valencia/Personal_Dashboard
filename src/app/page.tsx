import { cookies } from "next/headers";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Dashboard } from "@/components/Dashboard";
import { LocationSync } from "@/components/LocationSync";
import { config } from "@/lib/config";
import { getDashboardData } from "@/lib/dashboard-data";
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
  const sky = parseSkyPreview(sp);
  // Preview only: ?now=14.5 shows the page as if it were 2:30pm (greeting, scenes, curve). The live clock still runs.
  const previewNow = Number(typeof sp.now === "string" ? sp.now : NaN);
  const shown = Number.isFinite(previewNow) && previewNow >= 0 && previewNow < 24 ? { ...data, today: { ...data.today, nowHour: previewNow } } : data;
  return (
    <>
      <Dashboard data={sky ? { ...shown, weather: { ...shown.weather, sky } } : shown} settings={settings} />
      <LocationSync />
      <AutoRefresh />
    </>
  );
}
