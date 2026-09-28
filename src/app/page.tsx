import { cookies } from "next/headers";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Dashboard } from "@/components/Dashboard";
import { LocationSync } from "@/components/LocationSync";
import { getDashboardData } from "@/lib/dashboard-data";
import { parseLocationOverride } from "@/lib/location";
import { PREFS_COOKIE, parseSettings, readStoredSettings } from "@/lib/settings";

// Always render per-request: "now", weather and mail all move through the day.
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const [sp, cookieStore] = await Promise.all([searchParams, cookies()]);
  const settings = parseSettings(
    sp,
    readStoredSettings(cookieStore.get(PREFS_COOKIE)?.value),
  );
  const data = await getDashboardData(parseLocationOverride(sp));
  return (
    <>
      <Dashboard data={data} settings={settings} />
      <LocationSync />
      <AutoRefresh />
    </>
  );
}
