"use client";

import { useState } from "react";
import { dayOffset, displayWeight, healthDate, type StrengthSeries } from "@/lib/health";

export function strengthPoints(series: StrengthSeries | undefined, today: string, weeks: number) {
  return series?.points.filter((p) => p.date >= dayOffset(today, -(weeks * 7 - 1)) && p.date <= today) ?? [];
}

export function StrengthChart({ today, series, unit, label, available = true }: { today: string; series: StrengthSeries[]; unit: "kg" | "lbs"; label: string; available?: boolean }) {
  const [selected, setSelected] = useState(series[0]?.id ?? "");
  const [weeks, setWeeks] = useState(4);
  const lift = series.find((s) => s.id === selected) ?? series[0];
  const points = strengthPoints(lift, today, weeks);
  const valueOf = (value: number) => lift?.metric === "load" ? displayWeight(value, unit) : value;
  const values = points.map((p) => valueOf(p.value));
  const latest = values.at(-1);
  const delta = values.length > 1 ? Math.round((values[values.length - 1] - values[0]) * 10) / 10 : null;
  const metric = lift?.metric === "load" ? unit : "reps";
  const low = values.length ? Math.max(0, Math.floor(Math.min(...values) - 2)) : 0;
  const high = values.length ? Math.ceil(Math.max(...values) + 2) : 1;
  const from = dayOffset(today, -(weeks * 7 - 1));
  const x = (date: string) => 45 + (Date.parse(date) - Date.parse(from)) / (Date.parse(today) - Date.parse(from)) * 320;
  const y = (value: number) => 142 - (value - low) / (high - low) * 110;
  const line = points.map((p) => `${x(p.date)},${y(valueOf(p.value))}`).join(" ");
  return <section className="card health-panel health-strength" aria-labelledby="strength-title">
    <div className="health-panel__head"><h2 id="strength-title">Strength progress</h2><span className="health-source">{label}</span></div>
    {series.length ? <>
      <div className="health-chart-controls"><label className="health-sr-only" htmlFor="health-lift">Exercise and rep count</label><select id="health-lift" value={lift.id} onChange={(e) => setSelected(e.target.value)}>{series.map((item) => <option key={item.id} value={item.id}>{item.name}{item.reps !== null ? ` · ${item.reps} reps` : " · best reps"}</option>)}</select><div className="health-segments" aria-label="Chart period">{[4, 12].map((period) => <button type="button" key={period} aria-pressed={weeks === period} onClick={() => setWeeks(period)}>{period} weeks</button>)}</div></div>
      {latest !== undefined ? <>
        <div className="health-lift-value"><strong>{latest}<small> {metric}{lift.reps !== null ? ` × ${lift.reps}` : ""}</small></strong><span>{delta !== null ? `${delta > 0 ? "+" : ""}${delta} ${metric} across ${points.length} logged days` : "One matching logged day"}</span></div>
        <svg className="health-strength-chart" viewBox="0 0 400 182" role="img" aria-label={`${lift.name}, ${lift.reps !== null ? `${lift.reps} reps` : 'best reps'}: ${points.map((p) => `${healthDate(p.date)}: ${valueOf(p.value)} ${metric}`).join('; ')}`}>
          {[low, Math.round((low + high) * 5) / 10, high].map((value) => <g key={value}><line x1="45" x2="384" y1={y(value)} y2={y(value)} className="health-gridline" /><text x="0" y={y(value) + 4}>{value}</text></g>)}
          {points.length > 1 ? <><polygon points={`${x(points[0].date)},142 ${line} ${x(points[points.length - 1].date)},142`} className="health-chart-fill" /><polyline points={line} fill="none" className="health-chart-line" /></> : null}
          {points.map((p) => <circle key={p.date} cx={x(p.date)} cy={y(valueOf(p.value))} r="3.5" className="health-chart-dot"><title>{`${healthDate(p.date)}: ${valueOf(p.value)} ${metric}`}</title></circle>)}
          <text x="45" y="174">{healthDate(from)}</text><text x="365" y="174" textAnchor="end">{healthDate(today)}</text>
        </svg>
        <p className="health-caption">Best working set per logged day{lift.reps !== null ? ` at ${lift.reps} reps` : ""}. Warm-ups excluded.{points.length < 2 ? " Another comparable day is needed to show a change." : ""}</p>
      </> : <p className="health-muted health-empty">No matching sets in the last {weeks} weeks. Try the longer view or another exercise.</p>}
    </> : <p className="health-muted health-empty">{available ? "No comparable strength sets in the last 12 weeks. Logged workouts and exercises appear below as available." : "Strength data is temporarily unavailable while Hevy can’t be reached."}</p>}
  </section>;
}
