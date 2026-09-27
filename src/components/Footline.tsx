import { footLeft, footRight } from "@/lib/format";
import type { DashboardSettings } from "@/lib/settings";
import { use24Hour } from "@/lib/settings";
import type { AgendaEvent, TodayInfo } from "@/lib/types";
import { SettingsPanel } from "./SettingsPanel";

interface FootlineProps {
  agenda: AgendaEvent[];
  today: TodayInfo;
  settings: DashboardSettings;
}

export function Footline({ agenda, today, settings }: FootlineProps) {
  return (
    <footer className="footline">
      <div>{footLeft(agenda, today.nowHour)}</div>
      <div className="footline__right">
        <span>{footRight(today.nowHour, use24Hour(settings))}</span>
        <SettingsPanel settings={settings} />
      </div>
    </footer>
  );
}
