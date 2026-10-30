import { dateLineFor, greetingFor } from "@/lib/format";
import { use24Hour } from "@/lib/settings";
import type { DashboardSettings, Theme } from "@/lib/settings";
import type { DashboardData } from "@/lib/types";
import { briefLines, highLow, simpleOutlook, type BriefIcon } from "@/lib/weather-brief";
import { ClockCard } from "./ClockCard";
import { TempCurve } from "./TempCurve";
import { WeatherScene } from "./WeatherScene";
import { AmbientButton } from "./Ambient";

/**
 * EXPERIMENT. One card for the top row: the greeting and the clock across the top, the weather
 * in a single line under the greeting, the day's temperature curve as a band across the full
 * width, and one scene (sun or moon included) behind all of it.
 */
export function TopUnified({ data, settings, theme, frozen }: { data: DashboardData; settings: DashboardSettings; theme: Theme; frozen: boolean }) {
  const { weather, today } = data;
  const isDay = today.nowHour >= weather.sunrise && today.nowHour < weather.sunset;
  const use24 = use24Hour(settings);
  const mode = settings.topRow;
  const hl = highLow(weather);
  return (
    <section className={`card card--scene topuni topuni--${mode}`}>
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
            {mode === "unified" ? (
              <>
                {weather.place ? <span className="topuni__place">{weather.place}</span> : null}
                <span className="topuni__place">{weather.footnote}</span>
              </>
            ) : (
              <>
                {hl ? <span className="topuni__place topuni__hl">{hl}</span> : null}
                {weather.feelsLike != null && Math.abs(weather.feelsLike - weather.tempNow) >= 3 ? (
                  <span className="topuni__place">Feels {weather.feelsLike}°</span>
                ) : null}
                {mode === "simple" ? <span className="topuni__place">{simpleOutlook(weather, use24)}</span> : null}
              </>
            )}
          </div>
        </div>
        <div className="hello__time">
          <ClockCard today={today} use24={use24Hour(settings)} frozen={frozen} />
          <AmbientButton today={today} weather={weather} use24={use24Hour(settings)} theme={theme} frozen={frozen} />
        </div>
      </div>
      {mode === "brief" ? (
        <ul className="topuni__brief" aria-label="Weather that matters today">
          {briefLines(weather, data.agenda, today.nowHour, use24).map((l) => (
            <li key={l.icon} className={`brief brief--${l.icon}`}>
              <BriefGlyph icon={l.icon} />
              <span className="brief__text">{l.text}</span>
              {l.note ? <span className="brief__note">{l.note}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {mode !== "unified" ? null : (
      <>
      {/* A band across a wide card; the usual chart shape on a phone, where the band would flatten. */}
      <div className="topuni__curve topuni__curve--wide">
        <TempCurve weather={weather} arc={data.weatherArc} agenda={data.agenda} nowHour={today.nowHour} use24={use24} size="wide" refined />
      </div>
      <div className="topuni__curve topuni__curve--narrow">
        <TempCurve weather={weather} arc={data.weatherArc} agenda={data.agenda} nowHour={today.nowHour} use24={use24} size="full" refined />
      </div>
      </>
      )}
    </section>
  );
}

/** Small line icons for the brief, drawn in currentColor. */
function BriefGlyph({ icon }: { icon: BriefIcon }) {
  const p = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, className: "brief__icon" };
  switch (icon) {
    case "rain":
      return <svg {...p}><path d="M7 15a4 4 0 0 1 .5-8A5 5 0 0 1 17 8a3.5 3.5 0 0 1 0 7z" /><path d="M9 18l-1 2M13 18l-1 2M17 18l-1 2" /></svg>;
    case "dry":
      return <svg {...p}><path d="M12 4c3 4 5 6.5 5 9a5 5 0 0 1-10 0c0-2.5 2-5 5-9z" /><path d="M5 19L19 5" /></svg>;
    case "wind":
      return <svg {...p}><path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h8" /></svg>;
    case "sun":
      return <svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
    case "sunset":
    case "sunrise":
      return <svg {...p}><path d="M4 18h16M7 18a5 5 0 0 1 10 0" /><path d={icon === "sunset" ? "M12 3v6M9.5 6.5L12 9l2.5-2.5" : "M12 9V3M9.5 5.5L12 3l2.5 2.5"} /></svg>;
    default:
      return <svg {...p}><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>;
  }
}
