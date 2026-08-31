"use client";

import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { arcPct, formatHour } from "@/lib/format";
import type { DashboardSettings } from "@/lib/settings";
import { use24Hour } from "@/lib/settings";
import type { AgendaEvent, ArcWindow, HourlyTemp, Weather } from "@/lib/types";

interface WeatherCardProps {
  weather: Weather;
  /** Same window as the day arc — the curve lines up under it. */
  arc: ArcWindow;
  agenda: AgendaEvent[];
  nowHour: number;
  settings: DashboardSettings;
}

// Chart geometry — matches the Claude Design source.
const CW = 300;
const CH = 66;
const PAD_T = 12;
const PAD_B = 16;

/** Edge-aware anchor for a label sitting above point `x` (viewBox units). */
function labelAnchor(x: number): { left: string; transform: string } {
  const p = (x / CW) * 100;
  if (p <= 12) return { left: "0%", transform: "translate(0, -100%)" };
  if (p >= 88) return { left: "100%", transform: "translate(-100%, -100%)" };
  return { left: `${p.toFixed(1)}%`, transform: "translate(-50%, -100%)" };
}

function nearest(hourly: HourlyTemp[], hour: number): HourlyTemp {
  return hourly.reduce((a, b) =>
    Math.abs(b.h - hour) < Math.abs(a.h - hour) ? b : a,
  );
}

export function WeatherCard({
  weather,
  arc,
  agenda,
  nowHour,
  settings,
}: WeatherCardProps) {
  const use24 = use24Hour(settings);
  const [scrubHour, setScrubHour] = useState<number | null>(null);

  const H = weather.hourly;
  const hasCurve = H.length >= 2;

  const temps = H.map((p) => p.t);
  const tMin = hasCurve ? Math.min(...temps) : 0;
  const tMax = hasCurve ? Math.max(...temps) : 0;
  const span = Math.max(1, tMax - tMin);

  const cx = (h: number) => (arcPct(h, arc) / 100) * CW;
  const cy = (t: number) =>
    PAD_T + (1 - (t - tMin) / span) * (CH - PAD_T - PAD_B);

  const points = H.map((p) => `${cx(p.h).toFixed(1)},${cy(p.t).toFixed(1)}`);
  const tempLine = points.join(" ");
  const tempArea = `0,${CH} ${tempLine} ${CW},${CH}`;

  const peak = hasCurve ? H[temps.indexOf(tMax)] : undefined;
  const trough = hasCurve ? H[temps.indexOf(tMin)] : undefined;
  const nowPoint = hasCurve ? nearest(H, nowHour) : undefined;

  const scrub =
    scrubHour == null || !hasCurve ? null : nearest(H, scrubHour);
  const scrubBlock = scrub
    ? agenda.find((e) => scrub.h >= e.start && scrub.h < e.end)
    : undefined;
  const scrubPos = scrub ? labelAnchor(cx(scrub.h)) : null;

  const handleScrub = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setScrubHour(arc.from + ratio * (arc.to - arc.from));
  };
  const handleScrubEnd = () => setScrubHour(null);

  const scaleLabel = (h: number) => formatHour(h, use24).replace(":00", "");

  return (
    <section className="card weather">
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

      {hasCurve && peak && trough && nowPoint ? (
        <div className="tempcurve">
          <div
            className="tempcurve__plot"
            onPointerMove={handleScrub}
            onPointerDown={handleScrub}
            onPointerLeave={handleScrubEnd}
          >
            <svg
              className="tempcurve__chart"
              viewBox={`0 0 ${CW} ${CH}`}
              role="img"
              aria-label="Temperature through the day"
            >
              <polygon className="tempcurve__area" points={tempArea} />
              <polyline className="tempcurve__line" points={tempLine} />
              <circle
                className="tempcurve__marker"
                cx={cx(trough.h).toFixed(1)}
                cy={cy(trough.t).toFixed(1)}
                r="2.5"
              />
              <circle
                className="tempcurve__marker"
                cx={cx(peak.h).toFixed(1)}
                cy={cy(peak.t).toFixed(1)}
                r="2.5"
              />
              <circle
                className="tempcurve__now"
                cx={cx(nowPoint.h).toFixed(1)}
                cy={cy(nowPoint.t).toFixed(1)}
                r="3.5"
              />
              {scrub ? (
                <g>
                  <line
                    className="tempcurve__scrubline"
                    x1={cx(scrub.h).toFixed(1)}
                    x2={cx(scrub.h).toFixed(1)}
                    y1="0"
                    y2="50"
                  />
                  <circle
                    className="tempcurve__scrubdot"
                    cx={cx(scrub.h).toFixed(1)}
                    cy={cy(scrub.t).toFixed(1)}
                    r="3.5"
                  />
                </g>
              ) : null}
            </svg>

            <div
              className={`tempcurve__statics${scrub ? " tempcurve__statics--hidden" : ""}`}
            >
              <span
                className="tempcurve__note"
                style={{
                  left: labelAnchor(cx(peak.h)).left,
                  top: `${((cy(peak.t) / CH) * 100).toFixed(1)}%`,
                  transform: labelAnchor(cx(peak.h)).transform,
                }}
              >
                {tMax}° at {formatHour(peak.h, use24)}
              </span>
              <span
                className="tempcurve__note tempcurve__note--below"
                style={{
                  left: labelAnchor(cx(trough.h)).left,
                  top: `${((cy(trough.t) / CH) * 100).toFixed(1)}%`,
                  transform: labelAnchor(cx(trough.h)).transform,
                }}
              >
                {tMin}° low
              </span>
            </div>

            {scrub && scrubPos ? (
              <div
                className="tempcurve__readout"
                style={{ left: scrubPos.left, transform: scrubPos.transform }}
              >
                <span className="tempcurve__readout-temp">{scrub.t}°</span>
                <span className="tempcurve__readout-time">
                  {formatHour(scrub.h, use24)}
                </span>
                <span className="tempcurve__readout-note">{scrub.note}</span>
                <span className="tempcurve__readout-block">
                  {scrubBlock ? scrubBlock.name : ""}
                </span>
              </div>
            ) : null}
          </div>

          <div className="tempcurve__scale">
            <span>{scaleLabel(arc.from)}</span>
            <span>{scaleLabel((arc.from + arc.to) / 2)}</span>
            <span>{scaleLabel(arc.to)}</span>
          </div>
        </div>
      ) : null}

      <div className="weather__foot">{weather.footnote}</div>
    </section>
  );
}
