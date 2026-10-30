import { footLeft, footRight } from "@/lib/format";
import type { DashboardSettings, Theme } from "@/lib/settings";
import { use24Hour } from "@/lib/settings";
import Link from "next/link";
import type { ReactNode } from "react";
import type { AgendaEvent, TodayInfo } from "@/lib/types";
import { SettingsPanel } from "./SettingsPanel";

interface FootlineProps {
  agenda: AgendaEvent[];
  today: TodayInfo;
  settings: DashboardSettings;
  /** The theme actually rendered (settings.theme may be "timed"). */
  shownTheme: Theme;
  /** The Ambient button, here when the top row has no room for it (classic). */
  ambient?: ReactNode;
}

export function Footline({ agenda, today, settings, shownTheme, ambient }: FootlineProps) {
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
        {ambient}
        <SettingsPanel settings={settings} shownTheme={shownTheme} />
      </div>
    </footer>
  );
}
