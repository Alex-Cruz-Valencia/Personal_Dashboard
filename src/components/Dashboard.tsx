import { use24Hour, type DashboardSettings } from "@/lib/settings";
import type { DashboardData } from "@/lib/types";
import { MOCK_TODAY } from "@/lib/mock-data";
import { AttentionStrip } from "./AttentionStrip";
import { SkyTint } from "./SkyTint";
import { ClockCard } from "./ClockCard";
import { DayCalendar } from "./DayCalendar";
import { FocusProvider } from "./Focus";
import { EventDetailProvider } from "./EventDetail";
import { Footline } from "./Footline";
import { HelloCard } from "./HelloCard";
import { TaskDetailProvider } from "./TaskDetail";
import { TaskList } from "./TaskList";
import { WeatherCard } from "./WeatherCard";
import { WeekStrip } from "./WeekStrip";

interface DashboardProps {
  data: DashboardData;
  settings: DashboardSettings;
}

/**
 * The full morning view. Layout and class names mirror the Claude Design
 * source exactly — see `globals.css` for the ported stylesheet.
 */
export function Dashboard({ data, settings }: DashboardProps) {
  const frozen = data.today.iso === MOCK_TODAY.iso && data.today.nowHour === MOCK_TODAY.nowHour;
  return (
    <FocusProvider nowHour={data.today.nowHour}>
    <EventDetailProvider
      use24={use24Hour(settings)}
      theme={settings.theme}
      todayIso={data.today.iso}
    >
      <TaskDetailProvider theme={settings.theme}>
        {/* "system" leaves the attribute off so globals.css can fall through
            to prefers-color-scheme (see the effective-theme block there). */}
        <div
          className={`morning${settings.surface === "glass" ? " morning--glass" : ""}${settings.motion === "off" ? " morning--still" : ""}`}
          data-theme={settings.theme === "system" ? undefined : settings.theme}
        >
          {/* Everything above is unchanged. Experiment: below it, the day arc and
              the three columns (tasks / plan / replies) are replaced by a
              vertical calendar beside today's tasks. Archived from this view
              (components kept, not rendered): DayArc, PlanCard, EmailList. */}
          {settings.surface === "glass" && settings.motion === "on" ? (
            <SkyTint today={data.today} sunrise={data.weather.sunrise} sunset={data.weather.sunset} frozen={frozen} />
          ) : null}
          <div className="topbar">
            <HelloCard user={data.user} today={data.today} dayNote={data.dayNote}>
              <ClockCard
                today={data.today}
                arc={data.arc}
                agenda={data.agenda}
                sunrise={data.weather.sunrise}
                sunset={data.weather.sunset}
                use24={use24Hour(settings)}
                frozen={frozen}
              />
            </HelloCard>
            <WeatherCard
              weather={data.weather}
              arc={data.weatherArc}
              agenda={data.agenda}
              nowHour={data.today.nowHour}
              settings={settings}
            />
          </div>

          <AttentionStrip
            agenda={data.agenda}
            tasks={data.tasks}
            replies={data.replies}
            nowHour={data.today.nowHour}
            theme={settings.theme}
            aiDraft={data.ai}
          />

          <div className="twocol">
            <DayCalendar
              agenda={data.agenda}
              arc={data.arc}
              today={data.today}
              settings={settings}
              frozen={frozen}
              focusTask={data.tasks.find((t) => !t.overdueDays)?.name ?? data.tasks[0]?.name}
            />
            <TaskList tasks={data.tasks} settings={settings} source={data.sources.tasks} />
          </div>

          {data.week ? <WeekStrip days={data.week} /> : null}

          <Footline agenda={data.agenda} today={data.today} settings={settings} />
        </div>
      </TaskDetailProvider>
    </EventDetailProvider>
    </FocusProvider>
  );
}
