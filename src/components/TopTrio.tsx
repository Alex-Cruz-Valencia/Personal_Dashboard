import { dateLineFor, greetingFor } from "@/lib/format";
import { use24Hour } from "@/lib/settings";
import type { DashboardSettings } from "@/lib/settings";
import type { DashboardData } from "@/lib/types";
import { ClockCard } from "./ClockCard";
import { TempCurve } from "./TempCurve";
import { WeatherScene } from "./WeatherScene";

/**
 * EXPERIMENT. The top row split into three equal-weight tiles: the greeting, the time, and a slim
 * weather tile (temperature, condition and a sparkline). The sun or moon lives in the weather tile.
 */
export function TopTrio({ data, settings, frozen }: { data: DashboardData; settings: DashboardSettings; frozen: boolean }) {
  const { weather, today } = data;
  const isDay = today.nowHour >= weather.sunrise && today.nowHour < weather.sunset;
  const scene = settings.motion === "on";
  return (
    <div className="toptrio">
      <section className="card card--scene tile tile--hello">
        {scene ? <WeatherScene sky={weather.sky} isDay={isDay} celestial={false} /> : null}
        <div className="hello__date">{dateLineFor(today.iso)}</div>
        <h1 className="hello__greeting">{greetingFor(today.nowHour, data.user.name)}</h1>
      </section>
      <section className="card tile tile--time" aria-label="Time">
        <ClockCard today={today} use24={use24Hour(settings)} frozen={frozen} />
      </section>
      <section className="card card--scene tile tile--weather">
        {scene ? <WeatherScene sky={weather.sky} isDay={isDay} /> : null}
        <div className="tile__wxhead">
          <span className="topuni__temp">
            {weather.tempNow}
            <sup>°</sup>
          </span>
          <span className="tile__wxtext">
            <span className="topuni__cond">{weather.condition}</span>
            {weather.place ? <span className="topuni__place">{weather.place}</span> : null}
          </span>
        </div>
        <TempCurve weather={weather} arc={data.weatherArc} agenda={data.agenda} nowHour={today.nowHour} use24={use24Hour(settings)} size="spark" />
      </section>
    </div>
  );
}
