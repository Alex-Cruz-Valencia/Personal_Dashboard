import { shownTheme, use24Hour, type DashboardSettings, type ShownSettings } from "@/lib/settings";
import { sceneSky, skyHour } from "@/lib/day-part";
import type { DashboardData } from "@/lib/types";
import { reviewMode, reviewTasks } from "@/lib/day-review";
import { MOCK_TODAY } from "@/lib/mock-data";
import { AttentionStrip } from "./AttentionStrip";
import { SkyTint } from "./SkyTint";
import { ClockCard } from "./ClockCard";
import { DayCalendar } from "./DayCalendar";
import { FocusProvider } from "./Focus";
import { EventAlerts } from "./EventAlerts";
import { EventDetailProvider } from "./EventDetail";
import { Footline } from "./Footline";
import { AmbientClock } from "./Ambient";
import { HelloCard } from "./HelloCard";
import { TaskDetailProvider } from "./TaskDetail";
import { ReviewPrompt } from "./ReviewPrompt";
import { SourceNotice } from "./SourceNotice";
import { TaskList } from "./TaskList";
import { TopUnified } from "./TopUnified";
import { UndoToast } from "./UndoToast";
import { WeatherCard } from "./WeatherCard";
import { WeatherScene } from "./WeatherScene";
import { WeekStrip } from "./WeekStrip";
import { DashboardNav } from "./DashboardNav";

interface DashboardProps {
  data: DashboardData;
  settings: DashboardSettings;
  /** Coming back from a Google sign-in that didn't work. */
  connectFailed?: boolean;
}

/**
 * The full morning view. Layout and class names mirror the Claude Design
 * source exactly — see `globals.css` for the ported stylesheet.
 */
export function Dashboard({ data, settings: chosen, connectFailed = false }: DashboardProps) {
  // "timed" resolves to light or dark by the sun for this render; AutoRefresh's
  // minute re-render flips it at sunrise / sunset. The panel still sees the choice.
  // Picking Night under ⚙ Sky time always shows the dark page, since that's what the night sky is made for.
  const nightPicked = chosen.skyTheme === "time" && chosen.skyPart === "night";
  const settings: ShownSettings = { ...chosen, theme: nightPicked ? "dark" : shownTheme(chosen.theme, skyHour(data.today.nowHour, data.weather, chosen), data.weather) };
  const frozen = data.today.iso === MOCK_TODAY.iso && data.today.nowHour === MOCK_TODAY.nowHour;
  const use24 = use24Hour(settings);
  // The weather scene across the whole page (cards turn frosted so it shows through).
  const scene = sceneSky(data.today.nowHour, data.weather, settings);
  const review = reviewMode(data.today.nowHour, settings.windDown);
  const tomorrow = data.week?.find((d) => d.iso > data.today.iso) ?? null;
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
          className={`morning${settings.surface === "glass" ? " morning--glass" : ""}${settings.motion === "off" ? " morning--still" : ""}${pageScene ? " morning--scene" : ""}${settings.look === "clean" ? " morning--clean" : ""}${settings.calLook === "google" ? " morning--gcal" : ""}`}
          data-theme={settings.theme === "system" ? undefined : settings.theme}
          data-palette={settings.lightPalette}
          data-lightsky={settings.lightSky}
        >
          {/* Everything above is unchanged. Experiment: below it, the day arc and
              the three columns (tasks / plan / replies) are replaced by a
              vertical calendar beside today's tasks. Archived from this view
              (components kept, not rendered): DayArc, PlanCard, EmailList. */}
          {pageScene ? (
            <WeatherScene
              variant="page"
              sky={data.weather.sky}
              {...scene}
            />
          ) : null}
          {settings.surface === "glass" && settings.motion === "on" ? (
            <SkyTint today={data.today} sunrise={data.weather.sunrise} sunset={data.weather.sunset} frozen={frozen} />
          ) : null}
          <div className="dashboard-shell">
          <DashboardNav active="day" />
          <div className="dashboard-content">
          {settings.topRow !== "classic" ? (
            <TopUnified data={data} settings={settings} theme={settings.theme} frozen={frozen} />
          ) : (
            <div className="topbar">
              <HelloCard
                user={data.user}
                today={data.today}
                scene={
                  settings.motion === "on" ? (
                    <WeatherScene
                      sky={data.weather.sky}
                      {...scene}
                      celestial={false}
                    />
                  ) : null
                }
              >
                <AmbientClock today={data.today} weather={data.weather} use24={use24} theme={settings.theme} frozen={frozen} settings={settings}>
                  <ClockCard
                    today={data.today}
                    use24={use24}
                    frozen={frozen}
                  />
                </AmbientClock>
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

          <SourceNotice sources={data.sources} reconnect={data.googleReconnect} connectFailed={connectFailed} />

          {data.sources.tasks === "live" ? (
            <ReviewPrompt count={reviewTasks(data.tasks, review).length} mode={review} todayIso={data.today.iso} />
          ) : null}

          {/* Sample rows never count as things that need you; the notice above says what's missing. */}
          <AttentionStrip
            agenda={data.sources.calendar === "mock" ? [] : data.agenda}
            tasks={data.sources.tasks === "mock" ? [] : data.tasks}
            replies={data.sources.email === "mock" ? [] : data.replies}
            waiting={data.waiting}
            okShared={data.okConflicts}
            incomplete={data.sources.calendar === "mock" || data.sources.tasks === "mock" || data.sources.email === "mock"}
            nowHour={data.today.nowHour}
            theme={settings.theme}
            aiDraft={data.ai}
            canTask={data.canAddTasks}
            todayIso={data.today.iso}
            use24={use24}
          />

          <div className="twocol">
            <DayCalendar
              agenda={data.agenda}
              allDay={data.allDay}
              arc={data.arc}
              today={data.today}
              settings={settings}
              frozen={frozen}
              editable={data.sources.calendar === "live"}
              source={data.sources.calendar}
              reconnect={data.googleReconnect}
              tomorrow={tomorrow}
              sunset={data.weather.sunset}
              forecast={data.weather.tomorrow}
            />
            <TaskList tasks={data.tasks} settings={settings} source={data.sources.tasks} ai={data.ai} clarifyCount={data.clarifyCount} todayIso={data.today.iso} nowHour={data.today.nowHour} tomorrow={tomorrow} agenda={data.agenda} canPlan={data.sources.calendar === "live"} />
          </div>

          {data.week ? <WeekStrip days={data.week} use24={use24} gcal={settings.calLook === "google"} /> : null}

          <Footline
            agenda={data.agenda}
            today={data.today}
            settings={chosen}
            shownTheme={settings.theme}
          />
          <UndoToast />
          {data.sources.calendar === "live" ? <EventAlerts agenda={data.agenda} today={data.today} use24={use24} /> : null}
          </div>
          </div>
        </div>
      </TaskDetailProvider>
    </EventDetailProvider>
    </FocusProvider>
  );
}
