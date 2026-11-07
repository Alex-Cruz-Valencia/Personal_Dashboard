"use client";
import { useState } from 'react';
import { dayOffset, displayWeight, healthDate, type TrainingData, type HealthWorkout } from '@/lib/health';
import { overallProgress } from '@/lib/health-progress';
import { StrengthChart } from './StrengthChart';

export function ProgressOverview({ training, today, onWorkout }: { training: TrainingData; today: string; onWorkout: (workout: HealthWorkout) => void }) {
  const [weeks, setWeeks] = useState(4);
  const progress = overallProgress(training.lifts, today, weeks);
  const days = Array.from({length: weeks * 7}, (_, i) => dayOffset(today, i - (weeks * 7 - 1)));
  const sessions = training.workouts.filter(w => w.date && w.date >= days[0] && w.date <= today);
  const available = training.source !== 'unavailable';
  const max = Math.max(5, ...progress.rows.map(r => Math.abs(r.percent)));
  return <section className="card health-panel health-progress" aria-labelledby="overall-progress-title">
    <div className="health-panel__head"><div><span className="health-eyebrow">THE BIG PICTURE</span><h2 id="overall-progress-title">Your training, in perspective</h2></div><div className="health-segments" aria-label="Overall progress period">{[4,12].map(n => <button key={n} type="button" aria-pressed={weeks === n} onClick={() => setWeeks(n)}>{n} weeks</button>)}</div></div>
    <div className="health-progress-layout">
      <div className="health-progress-story"><span className="health-stat-label">Across your exercises</span><strong className="health-progress-number">{progress.median === null ? '—' : `${progress.median > 0 ? '+' : ''}${progress.median.toFixed(1)}%`}</strong><p>{!available ? 'Waiting for Hevy' : progress.median === null ? 'More comparable sessions needed' : progress.median > .5 ? 'Your typical comparison is moving up' : progress.median < -.5 ? 'Your typical comparison is moving down' : 'Your typical comparison is steady'}</p><span className="health-caption">Median change across {progress.rows.length} comparable exercises. {progress.unpaired} more need another matching logged day.</span>
        <div className="health-direction-key"><span>↗ {progress.improving} improving</span><span>→ {progress.steady} steady</span><span>↘ {progress.declining} declining</span></div>
        <p className="health-caption">A snapshot of logged performance, not a complete measure of strength. Exercise mix and effort can affect the picture.</p>
      </div>
      <div><div className="health-section-label"><h3>Exercise progression</h3><span>First → latest matching day</span></div>
        {progress.rows.length ? <div className="health-progress-rows">{progress.rows.map(r => <div className="health-progress-row" key={r.series.id}><div><strong>{r.series.name}</strong><small>{r.series.reps !== null ? `${r.series.reps} reps · ` : ''}{r.series.metric === 'load' ? `${displayWeight(r.first, training.weightUnit)} → ${displayWeight(r.last, training.weightUnit)} ${training.weightUnit}` : `${r.first} → ${r.last} reps`} · {r.days} days</small></div><div className="health-diverging" aria-hidden="true"><i/><span data-direction={r.percent < -.5 ? 'down' : r.percent > .5 ? 'up' : 'steady'} style={{left: r.percent < 0 ? `${50 - Math.abs(r.percent)/max*50}%` : '50%', width: `${Math.max(1,Math.abs(r.percent)/max*50)}%`}} /></div><strong>{r.percent > .5 ? '↗' : r.percent < -.5 ? '↘' : '→'} {r.percent > 0 ? '+' : ''}{r.percent.toFixed(1)}%</strong></div>)}</div> : <p className="health-muted health-empty">{available ? sessions.length ? 'There are no repeat exercise-and-rep comparisons in this window. Try 12 weeks.' : 'No workouts in this window. Try 12 weeks to explore earlier training.' : 'Progress will appear when Hevy reconnects.'}</p>}
      </div>
    </div>
    <div className="health-activity-head"><div><h3>Your training rhythm</h3><p className="health-caption">{available ? `${sessions.length} sessions · ${days.filter(d => sessions.some(w => w.date === d)).length} active days` : 'Training unavailable'} · {healthDate(days[0])}–{healthDate(today)}</p></div><span className="health-caption">Filled tile = logged training</span></div>
    <div className="health-activity-map" data-weeks={weeks}>{days.map(date => { const daily = sessions.filter(w => w.date === date); return <button type="button" key={date} disabled={!daily.length} data-active={daily.length > 0} data-today={date === today} title={`${healthDate(date)}: ${available ? `${daily.length} sessions` : 'unavailable'}`} aria-label={`${healthDate(date)}: ${available ? `${daily.length} sessions${daily.length ? '. Open latest workout' : ''}` : 'unavailable'}`} onClick={() => daily[0] && onWorkout(daily[0])}>{new Date(`${date}T12:00:00Z`).getUTCDate()}<span>{daily.length ? '●' : '·'}</span></button>; })}</div>
    <details className="health-disclosure health-method"><summary>How these comparisons work</summary><p className="health-caption">For each exercise, we use the rep count with the most logged days in this window and compare its first and latest best working set. Each exercise gets one vote in the median. Warm-ups and assisted movements are excluded. Changes within ±0.5% count as steady. Different rep counts are not directly compared, and missing days are not zeroes.</p></details>
    <details className="health-disclosure"><summary>Explore an individual exercise</summary><StrengthChart today={today} series={training.lifts} unit={training.weightUnit} label={training.source === 'sample' ? 'Sample' : 'Hevy'} available={available}/></details>
  </section>;
}
