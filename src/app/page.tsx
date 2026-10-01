import { cookies } from "next/headers";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Dashboard } from "@/components/Dashboard";
import { LocationSync } from "@/components/LocationSync";
import { config } from "@/lib/config";
import { getDashboardData } from "@/lib/dashboard-data";
import { parseLocationOverride } from "@/lib/location";
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
  }, { noteStyle: settings.noteStyle, use24: settings.timeFormat === "24-hour" });
  return (
    <>
      <Dashboard data={data} settings={settings} />
      <LocationSync />
      <AutoRefresh />
    </>
  );
}
