import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { DashboardNav } from "@/components/DashboardNav";
import { HealthDashboard } from "@/components/health/HealthDashboard";
import { SettingsPanel } from "@/components/SettingsPanel";
import { WeatherScene } from "@/components/WeatherScene";
import { AutoRefresh } from "@/components/AutoRefresh";
import { config, features } from "@/lib/config";
import { sceneSky, skyHour } from "@/lib/day-part";
import { healthDate } from "@/lib/health";
import { parseLocationOverride, resolveLocation } from "@/lib/location";
import { MOCK_WEATHER } from "@/lib/mock-data";
import { parseSettings, PREFS_COOKIE, readStoredSettings, shownTheme } from "@/lib/settings";
import { decimalHourInZone, isoDateInZone } from "@/lib/time";
import { getWeather } from "@/lib/weather/open-meteo";
import { getFatSecretNutrition } from "@/lib/fatsecret/data";
import { getHevyTraining } from "@/lib/hevy/data";

export const metadata: Metadata = { title: "Health · Personal Dashboard", description: "Training, recovery, daily energy, and a little space to check in with yourself." };
export const dynamic = "force-dynamic";

export default async function HealthPage({ searchParams }: PageProps<"/health">) {
  const [sp, cookieStore] = await Promise.all([searchParams, cookies()]);
  const settings = parseSettings(sp, {
    dayStart: config.arcFrom, dayEnd: config.arcTo, weatherStart: config.arcFrom,
    ...readStoredSettings(cookieStore.get(PREFS_COOKIE)?.value),
  });
  // Reuse location and appearance without fetching unrelated tasks, mail, or AI summaries.
  const location = await resolveLocation(parseLocationOverride(sp));
  const now = new Date();
  const today = isoDateInZone(now, location.timezone);
  const hour = decimalHourInZone(now, location.timezone);
  const [weather, training, nutrition] = await Promise.all([
    features.weather ? getWeather(location, { from: settings.weatherStart, to: settings.dayEnd }).catch(() => MOCK_WEATHER) : MOCK_WEATHER,
    getHevyTraining(today, location.timezone),
    getFatSecretNutrition(today),
  ]);
  const theme = settings.skyTheme === "time" && settings.skyPart === "night" ? "dark" : shownTheme(settings.theme, skyHour(hour, weather, settings), weather);
  const pageScene = settings.motion === "on" && settings.background === "scene";
  return <div className={`morning morning--health${settings.look === "clean" ? " morning--clean" : ""}${settings.surface === "glass" ? " morning--glass" : ""}${settings.motion === "off" ? " morning--still" : ""}${pageScene ? " morning--scene" : ""}`} data-theme={theme === "system" ? undefined : theme} data-palette={settings.lightPalette} data-lightsky={settings.lightSky}>
    {pageScene ? <WeatherScene variant="page" sky={weather.sky} {...sceneSky(hour, weather, settings)} /> : null}
    <div className="dashboard-shell">
    <DashboardNav active="health" />
    <div className="dashboard-content">
    <HealthDashboard key={today} today={today} timezone={location.timezone} training={training} nutrition={nutrition} />
    <footer className="footline"><span>{healthDate(today, { weekday: "long", month: "long", day: "numeric" })}</span><div className="footline__right"><nav className="footline__links" aria-label="Legal"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav><SettingsPanel settings={settings} shownTheme={theme} /></div></footer>
    <AutoRefresh />
    </div>
    </div>
  </div>;
}
