"use client";

import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { arcPct, formatHour } from "@/lib/format";
import type { AgendaEvent, ArcWindow, HourlyTemp, Weather } from "@/lib/types";

/** Chart geometry in viewBox units, per size: the weather card's full chart, a card-wide band, a slim sparkline. */
const SHAPES = {
  full: { cw: 300, ch: 66, pt: 12, pb: 16 },
  wide: { cw: 1200, ch: 54, pt: 15, pb: 12 },
  spark: { cw: 300, ch: 38, pt: 7, pb: 7 },
} as const;

export type CurveSize = keyof typeof SHAPES;

function nearest(hourly: HourlyTemp[], hour: number): HourlyTemp {
  return hourly.reduce((a, b) => (Math.abs(b.h - hour) < Math.abs(a.h - hour) ? b : a));
}

/**
 * The day's temperature as a curve you can scrub: a dot for now, the high and the low noted, and
 * what you have on at the hour under your finger. Used at three sizes by the weather card and
 * the experimental top rows.
 */
export function TempCurve({
  weather,
  arc,
  agenda,
  nowHour,
  use24,
  size = "full",
}: {
  weather: Weather;
  arc: ArcWindow;
  agenda: AgendaEvent[];
  nowHour: number;
  use24: boolean;
  size?: CurveSize;
}) {
  const { cw: CW, ch: CH, pt: PAD_T, pb: PAD_B } = SHAPES[size];
  const [scrubHour, setScrubHour] = useState<number | null>(null);

  const H = weather.hourly;
  if (H.length < 2) return null;

  const temps = H.map((p) => p.t);
  const tMin = Math.min(...temps);
  const tMax = Math.max(...temps);
  const span = Math.max(1, tMax - tMin);

  const cx = (h: number) => (arcPct(h, arc) / 100) * CW;
  const cy = (t: number) => PAD_T + (1 - (t - tMin) / span) * (CH - PAD_T - PAD_B);

  /** Edge-aware anchor for a label sitting above point `x` (viewBox units). */
  const labelAnchor = (x: number): { left: string; transform: string } => {
    const p = (x / CW) * 100;
    if (p <= 12) return { left: "0%", transform: "translate(0, -100%)" };
    if (p >= 88) return { left: "100%", transform: "translate(-100%, -100%)" };
    return { left: `${p.toFixed(1)}%`, transform: "translate(-50%, -100%)" };
  };

  const points = H.map((p) => `${cx(p.h).toFixed(1)},${cy(p.t).toFixed(1)}`);
  const tempLine = points.join(" ");
  const tempArea = `0,${CH} ${tempLine} ${CW},${CH}`;

  const peak = H[temps.indexOf(tMax)];
  const trough = H[temps.indexOf(tMin)];
  const nowPoint = nearest(H, nowHour);

  const scrub = scrubHour == null ? null : nearest(H, scrubHour);
  const scrubBlock = scrub ? agenda.find((e) => scrub.h >= e.start && scrub.h < e.end) : undefined;
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
    <div className={`tempcurve tempcurve--${size}`}>
      <div className="tempcurve__plot" onPointerMove={handleScrub} onPointerDown={handleScrub} onPointerLeave={handleScrubEnd}>
        <svg className="tempcurve__chart" viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label="Temperature through the day">
          <polygon className="tempcurve__area" points={tempArea} />
          <polyline className="tempcurve__line" points={tempLine} />
          <circle className="tempcurve__marker" cx={cx(trough.h).toFixed(1)} cy={cy(trough.t).toFixed(1)} r="2.5" />
          <circle className="tempcurve__marker" cx={cx(peak.h).toFixed(1)} cy={cy(peak.t).toFixed(1)} r="2.5" />
          <circle className="tempcurve__now" cx={cx(nowPoint.h).toFixed(1)} cy={cy(nowPoint.t).toFixed(1)} r="3.5" />
          {scrub ? (
            <g>
              <line className="tempcurve__scrubline" x1={cx(scrub.h).toFixed(1)} x2={cx(scrub.h).toFixed(1)} y1="0" y2={CH - PAD_B + 4} />
              <circle className="tempcurve__scrubdot" cx={cx(scrub.h).toFixed(1)} cy={cy(scrub.t).toFixed(1)} r="3.5" />
            </g>
          ) : null}
        </svg>

        <div className={`tempcurve__statics${scrub ? " tempcurve__statics--hidden" : ""}`}>
          <span
            className="tempcurve__note"
            style={{ left: labelAnchor(cx(peak.h)).left, top: `${((cy(peak.t) / CH) * 100).toFixed(1)}%`, transform: labelAnchor(cx(peak.h)).transform }}
          >
            {tMax}° at {formatHour(peak.h, use24)}
          </span>
          <span
            className="tempcurve__note tempcurve__note--below"
            style={{ left: labelAnchor(cx(trough.h)).left, top: `${((cy(trough.t) / CH) * 100).toFixed(1)}%`, transform: labelAnchor(cx(trough.h)).transform }}
          >
            {tMin}° low
          </span>
        </div>

        {scrub && scrubPos ? (
          <div className="tempcurve__readout" style={{ left: scrubPos.left, transform: scrubPos.transform }}>
            <span className="tempcurve__readout-temp">{scrub.t}°</span>
            <span className="tempcurve__readout-time">{formatHour(scrub.h, use24)}</span>
            <span className="tempcurve__readout-note">{scrub.note}</span>
            <span className="tempcurve__readout-block">{scrubBlock ? scrubBlock.name : ""}</span>
          </div>
        ) : null}
      </div>

      <div className="tempcurve__scale">
        <span>{scaleLabel(arc.from)}</span>
        <span>{scaleLabel((arc.from + arc.to) / 2)}</span>
        <span>{scaleLabel(arc.to)}</span>
      </div>
    </div>
  );
}
