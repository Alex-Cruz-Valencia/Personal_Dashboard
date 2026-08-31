import { daylightLabel } from "@/lib/format";
import type { Weather } from "@/lib/types";

interface WeatherCardProps {
  weather: Weather;
  /** Short place label, e.g. "Hanover, NH". Hidden when not known. */
  place?: string | null;
}

export function WeatherCard({ weather, place }: WeatherCardProps) {
  return (
    <section className="card weather">
      {place ? <div className="weather__place">{place}</div> : null}
      <div className="weather__main">
        <div className="weather__temp">
          {weather.tempNow}
          <sup>°</sup>
        </div>
        <div className="weather__condition">{weather.condition}</div>
      </div>
      <div className="weather__stats">
        <div className="weather__stat">
          <div className="weather__stat-key">High / Low</div>
          <div className="weather__stat-val">
            {weather.tempHigh}° / {weather.tempLow}°
          </div>
        </div>
        <div className="weather__stat">
          <div className="weather__stat-key">Daylight</div>
          <div className="weather__stat-val">
            {daylightLabel(weather.sunrise, weather.sunset)}
          </div>
        </div>
      </div>
      <div className="weather__foot">{weather.footnote}</div>
    </section>
  );
}
