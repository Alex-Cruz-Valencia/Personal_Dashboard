"use client";

import { useId, useState, type PointerEvent as ReactPointerEvent } from "react";
import { arcPct, formatHour } from "@/lib/format";
import type { AgendaEvent, ArcWindow, HourlyTemp, Weather } from "@/lib/types";

/** Chart geometry in viewBox units, per size: the weather card's full chart, or a band across a wide card. */
const SHAPES = {
  full: { cw: 300, ch: 66, pt: 12, pb: 16 },
  wide: { cw: 1200, ch: 62, pt: 9, pb: 13 },
} as const;

export type CurveSize = keyof typeof SHAPES;

/** A smooth curve through the points that never overshoots (monotone cubic), as an SVG path. */
function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  if (n < 2) return "";
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
  }
  const t: number[] = new Array(n);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
    } else {
      const a = t[i] / m[i];
      const b = t[i + 1] / m[i];
      const sq = a * a + b * b;
      if (sq > 9) {
        const k = 3 / Math.sqrt(sq);
        t[i] = k * a * m[i];
        t[i + 1] = k * b * m[i];
      }
    }
  }
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    d += ` C${f(pts[i][0] + dx[i] / 3)},${f(pts[i][1] + (t[i] * dx[i]) / 3)} ${f(pts[i + 1][0] - dx[i] / 3)},${f(pts[i + 1][1] - (t[i + 1] * dx[i]) / 3)} ${f(pts[i + 1][0])},${f(pts[i + 1][1])}`;
  }
  return d;
}

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
  refined = false,
}: {
  weather: Weather;
  arc: ArcWindow;
  agenda: AgendaEvent[];
  nowHour: number;
  use24: boolean;
  size?: CurveSize;
  /** The cleaner look: a smooth curve, a soft fill, the past dimmer than what's ahead, and bare high/low figures. */
  refined?: boolean;
}) {
  const { cw: CW, ch: CH, pt: PAD_T, pb: PAD_B } = SHAPES[size];
  const [scrubHour, setScrubHour] = useState<number | null>(null);
  const uid = useId().replace(/:/g, "");

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

  if (refined) {
    const pts = H.map((p): [number, number] => [cx(p.h), cy(p.t)]);
    const line = smoothPath(pts);
    const base = CH - PAD_B + 6;
    const area = `${line} L${CW},${base} L0,${base} Z`;
    const nowX = cx(nowPoint.h);
    const nowY = cy(nowPoint.t);
    /** High and low sit just beside their point (flipped at the right edge), so the curve can use the full height. */
    const beside = (x: number): { left: string; transform: string } => {
      // Flip to the left at the right edge, and away from the "now" dot when it is close by.
      const flip = (x / CW >= 0.88) !== (Math.abs(x - nowX) < CW * 0.05 && x >= nowX - 1);
      return { left: `${((x / CW) * 100).toFixed(1)}%`, transform: flip ? "translate(calc(-100% - 9px), -50%)" : "translate(9px, -50%)" };
    };
    return (
      <div className={`tempcurve tempcurve--${size} tempcurve--refined`}>
        <div className="tempcurve__plot" onPointerMove={handleScrub} onPointerDown={handleScrub} onPointerLeave={handleScrubEnd}>
          <svg className="tempcurve__chart" viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label="Temperature through the day">
            <defs>
              <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: "var(--accent)", stopOpacity: "var(--curve-fill, 0.26)" }} />
                <stop offset="1" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
              </linearGradient>
              <clipPath id={`ahead-${uid}`}>
                <rect x={nowX} y="0" width={Math.max(0, CW - nowX)} height={CH} />
              </clipPath>
            </defs>
            <path d={area} fill={`url(#fill-${uid})`} />
            <line className="tempcurve__baseline" x1="0" x2={CW} y1={base} y2={base} />
            <path className="tempcurve__line tempcurve__line--past" d={line} />
            <path className="tempcurve__line tempcurve__line--ahead" d={line} clipPath={`url(#ahead-${uid})`} />
            <line className="tempcurve__nowline" x1={nowX.toFixed(1)} x2={nowX.toFixed(1)} y1={nowY.toFixed(1)} y2={base} />
            <circle className="tempcurve__halo" cx={nowX.toFixed(1)} cy={nowY.toFixed(1)} r="7" />
            <circle className="tempcurve__now" cx={nowX.toFixed(1)} cy={nowY.toFixed(1)} r="3.6" />
            {scrub ? (
              <g>
                <line className="tempcurve__scrubline" x1={cx(scrub.h).toFixed(1)} x2={cx(scrub.h).toFixed(1)} y1="0" y2={base} />
                <circle className="tempcurve__scrubdot" cx={cx(scrub.h).toFixed(1)} cy={cy(scrub.t).toFixed(1)} r="3.6" />
              </g>
            ) : null}
          </svg>

          <div className={`tempcurve__statics${scrub ? " tempcurve__statics--hidden" : ""}`}>
            <span
              className="tempcurve__note tempcurve__note--hi"
              style={{ left: beside(cx(peak.h)).left, top: `${((cy(peak.t) / CH) * 100).toFixed(1)}%`, transform: beside(cx(peak.h)).transform }}
            >
              {tMax}°
            </span>
            <span
              className="tempcurve__note tempcurve__note--below tempcurve__note--lo"
              style={{ left: beside(cx(trough.h)).left, top: `${((cy(trough.t) / CH) * 100).toFixed(1)}%`, transform: beside(cx(trough.h)).transform }}
            >
              {tMin}°
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
