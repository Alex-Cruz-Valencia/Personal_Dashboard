import { Dashboard } from "@/components/Dashboard";
import { LocationSync } from "@/components/LocationSync";
import { getDashboardData } from "@/lib/dashboard-data";
import { parseLocationOverride } from "@/lib/location";
import { parseSettings } from "@/lib/settings";

// Always render per-request: "now", weather and mail all move through the day.
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const settings = parseSettings(sp);
  const data = await getDashboardData(parseLocationOverride(sp));
  return (
    <>
      <Dashboard data={data} settings={settings} />
      <LocationSync />
    </>
  );
}
