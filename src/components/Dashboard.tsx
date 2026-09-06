import { use24Hour, type DashboardSettings } from "@/lib/settings";
import type { DashboardData } from "@/lib/types";
import { CalendarAgenda } from "./CalendarAgenda";
import { DayArc } from "./DayArc";
import { EmailList } from "./EmailList";
import { EventDetailProvider } from "./EventDetail";
import { Footline } from "./Footline";
import { HelloCard } from "./HelloCard";
import { TaskDetailProvider } from "./TaskDetail";
import { TaskList } from "./TaskList";
import { WeatherCard } from "./WeatherCard";

interface DashboardProps {
  data: DashboardData;
  settings: DashboardSettings;
}

/**
 * The full morning view. Layout and class names mirror the Claude Design
 * source exactly — see `globals.css` for the ported stylesheet.
 */
export function Dashboard({ data, settings }: DashboardProps) {
  return (
    <EventDetailProvider use24={use24Hour(settings)} theme={settings.theme}>
      <TaskDetailProvider theme={settings.theme}>
        {/* "system" leaves the attribute off so globals.css can fall through
            to prefers-color-scheme (see the effective-theme block there). */}
        <div
          className="morning"
          data-theme={settings.theme === "system" ? undefined : settings.theme}
        >
          <div className="topbar">
            <HelloCard user={data.user} today={data.today} dayNote={data.dayNote} />
            <WeatherCard
              weather={data.weather}
              arc={data.arc}
              agenda={data.agenda}
              nowHour={data.today.nowHour}
              settings={settings}
            />
          </div>

          <DayArc
            agenda={data.agenda}
            tasks={data.tasks}
            arc={data.arc}
            today={data.today}
            settings={settings}
          />

          <div className="columns">
            <TaskList tasks={data.tasks} settings={settings} source={data.sources.tasks} />
            <CalendarAgenda
              agenda={data.agenda}
              today={data.today}
              settings={settings}
              source={data.sources.calendar}
            />
            <EmailList replies={data.replies} source={data.sources.email} />
          </div>

          <Footline agenda={data.agenda} today={data.today} settings={settings} />
        </div>
      </TaskDetailProvider>
    </EventDetailProvider>
  );
}
