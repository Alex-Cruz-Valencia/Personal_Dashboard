import { footLeft, footRight } from "@/lib/format";
import type { DashboardSettings } from "@/lib/settings";
import { use24Hour } from "@/lib/settings";
import Link from "next/link";
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
        <nav className="footline__links" aria-label="Legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
        {/* keyed on the text, so each refresh remounts it and replays the pulse */}
        <span key={footRight(today.nowHour, use24Hour(settings))} className="footline__stamp">
          <i aria-hidden />
          {footRight(today.nowHour, use24Hour(settings))}
        </span>
        <SettingsPanel settings={settings} />
      </div>
    </footer>
  );
}
