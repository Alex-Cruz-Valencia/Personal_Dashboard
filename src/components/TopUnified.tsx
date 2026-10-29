import { dateLineFor, greetingFor } from "@/lib/format";
import { use24Hour } from "@/lib/settings";
import type { DashboardSettings } from "@/lib/settings";
import type { DashboardData } from "@/lib/types";
import { ClockCard } from "./ClockCard";
import { TempCurve } from "./TempCurve";
import { WeatherScene } from "./WeatherScene";

/**
 * EXPERIMENT. One card for the top row: the greeting and the clock across the top, the weather
 * in a single line under the greeting, the day's temperature curve as a band across the full
 * width, and one scene (sun or moon included) behind all of it.
 */
export function TopUnified({ data, settings, frozen }: { data: DashboardData; settings: DashboardSettings; frozen: boolean }) {
  const { weather, today } = data;
  const isDay = today.nowHour >= weather.sunrise && today.nowHour < weather.sunset;
  return (
    <section className="card card--scene topuni">
      {settings.motion === "on" ? <WeatherScene sky={weather.sky} isDay={isDay} /> : null}
      <div className="topuni__head">
        <div className="topuni__hello">
          <div className="hello__date">{dateLineFor(today.iso)}</div>
          <h1 className="hello__greeting">{greetingFor(today.nowHour, data.user.name)}</h1>
          <div className="topuni__wx">
            <span className="topuni__temp">
              {weather.tempNow}
              <sup>°</sup>
            </span>
            <span className="topuni__cond">{weather.condition}</span>
            {weather.place ? <span className="topuni__place">{weather.place}</span> : null}
            <span className="topuni__place">{weather.footnote}</span>
          </div>
        </div>
        <div className="hello__time">
          <ClockCard today={today} use24={use24Hour(settings)} frozen={frozen} />
        </div>
      </div>
      {/* A band across a wide card; the usual chart shape on a phone, where the band would flatten. */}
      <div className="topuni__curve topuni__curve--wide">
        <TempCurve weather={weather} arc={data.weatherArc} agenda={data.agenda} nowHour={today.nowHour} use24={use24Hour(settings)} size="wide" />
      </div>
      <div className="topuni__curve topuni__curve--narrow">
        <TempCurve weather={weather} arc={data.weatherArc} agenda={data.agenda} nowHour={today.nowHour} use24={use24Hour(settings)} size="full" />
      </div>
    </section>
  );
}
