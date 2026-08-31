import { footLeft, footRight } from "@/lib/format";
import type { DashboardSettings } from "@/lib/settings";
import { use24Hour } from "@/lib/settings";
import type { AgendaEvent, TodayInfo } from "@/lib/types";

interface FootlineProps {
  agenda: AgendaEvent[];
  today: TodayInfo;
  settings: DashboardSettings;
}

export function Footline({ agenda, today, settings }: FootlineProps) {
  return (
    <footer className="footline">
      <div>{footLeft(agenda, today.nowHour)}</div>
      <div>{footRight(today.nowHour, use24Hour(settings))}</div>
    </footer>
  );
}
