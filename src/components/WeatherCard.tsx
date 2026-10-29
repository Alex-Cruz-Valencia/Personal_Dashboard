"use client";

import { use24Hour } from "@/lib/settings";
import type { DashboardSettings } from "@/lib/settings";
import type { AgendaEvent, ArcWindow, Weather } from "@/lib/types";
import { TempCurve } from "./TempCurve";
import { WeatherScene } from "./WeatherScene";

interface WeatherCardProps {
  weather: Weather;
  /**
   * The weather card's own window (`DashboardData.weatherArc`) — same end
   * as the day arc, independently configurable start.
   */
  arc: ArcWindow;
  agenda: AgendaEvent[];
  nowHour: number;
  settings: DashboardSettings;
}

export function WeatherCard({ weather, arc, agenda, nowHour, settings }: WeatherCardProps) {
  const use24 = use24Hour(settings);
  return (
    <section className="card weather">
      {settings.motion === "on" ? (
        <WeatherScene sky={weather.sky} isDay={nowHour >= weather.sunrise && nowHour < weather.sunset} />
      ) : null}
      {weather.place ? (
        <div className="weather__place">
          <i className="weather__place-dot" />
          <span className="weather__place-name">{weather.place}</span>
        </div>
      ) : null}

      <div className="weather__main">
        <div className="weather__temp">
          {weather.tempNow}
          <sup>°</sup>
        </div>
        <div className="weather__condition">{weather.condition}</div>
      </div>

      <TempCurve weather={weather} arc={arc} agenda={agenda} nowHour={nowHour} use24={use24} />

      <div className="weather__foot">{weather.footnote}</div>
    </section>
  );
}
