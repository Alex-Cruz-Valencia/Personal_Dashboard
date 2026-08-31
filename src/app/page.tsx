import { Dashboard } from "@/components/Dashboard";
import { getDashboardData } from "@/lib/dashboard-data";
import { parseSettings } from "@/lib/settings";

// Always render per-request: "now", weather and mail all move through the day.
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const settings = parseSettings(await searchParams);
  const data = await getDashboardData();
  return <Dashboard data={data} settings={settings} />;
}
