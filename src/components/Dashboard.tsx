import { shownTheme, use24Hour, type DashboardSettings, type ShownSettings } from "@/lib/settings";
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
import { TopUnified } from "./TopUnified";
import { WeatherCard } from "./WeatherCard";
import { WeatherScene } from "./WeatherScene";
import { WeekStrip } from "./WeekStrip";

interface DashboardProps {
  data: DashboardData;
  settings: DashboardSettings;
}

/**
 * The full morning view. Layout and class names mirror the Claude Design
 * source exactly — see `globals.css` for the ported stylesheet.
 */
export function Dashboard({ data, settings: chosen }: DashboardProps) {
  // "timed" resolves to light or dark by the sun for this render; AutoRefresh's
  // minute re-render flips it at sunrise / sunset. The panel still sees the choice.
  const settings: ShownSettings = { ...chosen, theme: shownTheme(chosen.theme, data.today.nowHour, data.weather) };
  const frozen = data.today.iso === MOCK_TODAY.iso && data.today.nowHour === MOCK_TODAY.nowHour;
  const use24 = use24Hour(settings);
  // The weather scene across the whole page (cards turn frosted so it shows through).
  const pageScene = settings.motion === "on" && settings.background === "scene";
  return (
    <FocusProvider nowHour={data.today.nowHour}>
    <EventDetailProvider
      use24={use24}
      theme={settings.theme}
      todayIso={data.today.iso}
    >
      <TaskDetailProvider theme={settings.theme} todayIso={data.today.iso} ai={data.ai}>
        {/* "system" leaves the attribute off so globals.css can fall through
            to prefers-color-scheme (see the effective-theme block there). */}
        <div
          className={`morning${settings.surface === "glass" ? " morning--glass" : ""}${settings.motion === "off" ? " morning--still" : ""}${pageScene ? " morning--scene" : ""}${settings.look === "clean" ? " morning--clean" : ""}`}
          data-theme={settings.theme === "system" ? undefined : settings.theme}
          data-palette={settings.lightPalette}
        >
          {/* Everything above is unchanged. Experiment: below it, the day arc and
              the three columns (tasks / plan / replies) are replaced by a
              vertical calendar beside today's tasks. Archived from this view
              (components kept, not rendered): DayArc, PlanCard, EmailList. */}
          {pageScene ? (
            <WeatherScene
              variant="page"
              sky={data.weather.sky}
              isDay={data.today.nowHour >= data.weather.sunrise && data.today.nowHour < data.weather.sunset}
            />
          ) : null}
          {settings.surface === "glass" && settings.motion === "on" ? (
            <SkyTint today={data.today} sunrise={data.weather.sunrise} sunset={data.weather.sunset} frozen={frozen} />
          ) : null}
          {settings.topRow === "unified" ? (
            <TopUnified data={data} settings={settings} frozen={frozen} />
          ) : (
            <div className="topbar">
              <HelloCard
                user={data.user}
                today={data.today}
                scene={
                  settings.motion === "on" ? (
                    <WeatherScene
                      sky={data.weather.sky}
                      isDay={data.today.nowHour >= data.weather.sunrise && data.today.nowHour < data.weather.sunset}
                      celestial={false}
                    />
                  ) : null
                }
              >
                <ClockCard
                  today={data.today}
                  use24={use24}
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
          )}

          <AttentionStrip
            agenda={data.agenda}
            tasks={data.tasks}
            replies={data.replies}
            nowHour={data.today.nowHour}
            theme={settings.theme}
            aiDraft={data.ai}
            canTask={data.canAddTasks}
            todayIso={data.today.iso}
          />

          <div className="twocol">
            <DayCalendar
              agenda={data.agenda}
              arc={data.arc}
              today={data.today}
              settings={settings}
              frozen={frozen}
              editable={data.sources.calendar === "live"}
              tomorrow={data.week?.find((d) => d.iso > data.today.iso) ?? null}
              focusTask={data.tasks.find((t) => !t.overdueDays)?.name ?? data.tasks[0]?.name}
              legend={data.calendars}
            />
            <TaskList tasks={data.tasks} settings={settings} source={data.sources.tasks} />
          </div>

          {data.week ? <WeekStrip days={data.week} use24={use24} /> : null}

          <Footline agenda={data.agenda} today={data.today} settings={chosen} shownTheme={settings.theme} />
        </div>
      </TaskDetailProvider>
    </EventDetailProvider>
    </FocusProvider>
  );
}
