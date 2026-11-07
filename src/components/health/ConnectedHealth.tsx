"use client";

import { useState } from 'react';
import { dayOffset, healthDate, hoursLabel, type HealthJournal, type HealthWorkout, type TrainingData } from '@/lib/health';
import { healthWeek } from '@/lib/health-timeline';
import { EMPTY_NUTRITION_GOALS, validNutritionGoals, type NutritionData, type NutritionGoals } from '@/lib/nutrition';

function NutritionTargets({ goals, onSave }: { goals: NutritionGoals; onSave: (goals: NutritionGoals) => boolean }) {
  const [message, setMessage] = useState('');
  return <details className="health-disclosure"><summary>Set your nutrition targets <span>Optional · saved in this browser</span></summary><form className="health-nutrition-targets" onSubmit={event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = (name: string) => form.get(name) === '' ? null : Number(form.get(name));
    const next = { protein: amount('protein'), calories: amount('calories') };
    if (!validNutritionGoals(next)) { setMessage('Check your targets and try again.'); return; }
    setMessage(onSave(next) ? 'Targets saved. Blank fields remove a target.' : 'This browser could not save your targets. Please try again.');
  }}><p className="health-caption">Choose your own targets. These are not imported from FatSecret or calculated from your workouts. Leave either blank to track without a target.</p><div><label>Protein · g/day<input type="number" name="protein" min="1" max="1000" step="any" defaultValue={goals.protein ?? ''} placeholder="Your target"/></label><label>Calories · kcal/day<input type="number" name="calories" min="1" max="20000" step="any" defaultValue={goals.calories ?? ''} placeholder="Your target"/></label><button className="health-btn" type="submit">Save targets</button></div><p className="health-caption" role="status">{message}</p></form></details>;
}

const nutritionStatus = (status: NutritionData['status']) => ({
  not_configured: 'FatSecret not connected', authorization_required: 'Diary authorization pending',
  disabled: 'Nutrition connection disabled', unavailable: 'FatSecret temporarily unavailable', connected: 'FatSecret · logged intake',
})[status];

export function ConnectedHealth({ today, training, journal, nutrition, onWorkout, onCheckin, onGoals }: {
  today: string; training: TrainingData; journal: HealthJournal; nutrition: NutritionData;
  onWorkout: (workout: HealthWorkout) => void; onCheckin: () => void; onGoals: (goals: NutritionGoals) => boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(today);
  const end = dayOffset(today, -offset * 7);
  const days = healthWeek(end, training, journal, nutrition);
  const day = days.find(d => d.date === selected) ?? days[6];
  const goals = journal.nutritionGoals ?? EMPTY_NUTRITION_GOALS;
  const meals = day.nutrition?.meals ?? [];
  const loggedDays = days.filter(d => d.nutrition !== null).length;
  const sleepMax = Math.max(10, journal.goals.sleep, ...days.map(d => d.sleep ?? 0));
  const proteinMax = Math.max(1, goals.protein ?? 0, ...days.map(d => d.nutrition?.totals.protein ?? 0));
  const trainingLabel = training.source === 'sample' ? 'Sample training' : training.source === 'cached' ? 'Hevy · last sync' : 'Hevy';
  const sleepLogged = days.filter(d => d.sleep !== null).length;
  const trainingDays = days.filter(d => d.workouts.length > 0).length;
  const navigate = (next: number) => { setOffset(next); setSelected(dayOffset(today, -next * 7)); };
  const fuelMetrics = [
    { key: 'protein' as const, name: 'Protein', unit: 'g', target: goals.protein },
    { key: 'calories' as const, name: 'Calories', unit: 'kcal', target: goals.calories },
    { key: 'carbohydrate' as const, name: 'Carbs', unit: 'g', target: null },
    { key: 'fat' as const, name: 'Fat', unit: 'g', target: null },
  ];
  return <>
    <section className="card health-panel health-rhythm" aria-labelledby="rhythm-title">
      <div className="health-panel__head"><div><span className="health-eyebrow">TRAIN · FUEL · RECOVER</span><h2 id="rhythm-title">Your week, together</h2><p className="health-caption">{healthDate(days[0].date)}–{healthDate(end)} · Select a day to see the whole picture.</p></div><div className="health-week-nav"><button type="button" className="health-btn" disabled={offset >= 11} aria-label="Previous week" onClick={() => navigate(offset+1)}>←</button><button type="button" className="health-btn" disabled={offset === 0} onClick={() => navigate(0)}>This week</button><button type="button" className="health-btn" disabled={offset === 0} aria-label="Next week" onClick={() => navigate(offset-1)}>→</button></div></div>
      <div className="health-rhythm-scroll"><table className="health-rhythm-table"><caption className="health-sr-only">Training, protein, sleep and energy aligned by calendar date. Dashes mean missing or unavailable data.</caption><thead><tr><th scope="col"><span className="health-caption">Same dates.<br/>Four perspectives.</span></th>{days.map(d => <th scope="col" key={d.date}><button type="button" aria-pressed={d.date === day.date} aria-label={`View ${healthDate(d.date)}${d.date === today ? ', today' : ''}`} onClick={() => setSelected(d.date)}><span>{healthDate(d.date, {weekday:'short'})}</span><strong>{healthDate(d.date, {day:'numeric'})}</strong><small>{d.date === today ? 'Today' : healthDate(d.date, {month:'short'})}</small></button></th>)}</tr></thead>
        <tbody>
          <tr><th scope="row">Training<small>{trainingLabel}</small></th>{days.map(d => <td key={d.date} data-selected={d.date === day.date}><span className="health-rhythm-workout" data-active={d.workouts.length > 0} aria-label={!d.trainingAvailable ? 'Unavailable' : `${d.workouts.length} logged sessions`}>{!d.trainingAvailable ? '—' : d.workouts.length ? `● ${d.workouts.length}` : '·'}</span></td>)}</tr>
          <tr><th scope="row">Protein<small>{nutrition.status === 'connected' ? 'FatSecret · g' : nutritionStatus(nutrition.status)}</small></th>{days.map(d => <td key={d.date} data-selected={d.date === day.date}>{d.nutrition ? <div className="health-rhythm-bar"><span style={{height:`${Math.max(0,d.nutrition.totals.protein/proteinMax*100)}%`}}/><strong>{Math.round(d.nutrition.totals.protein)}g</strong></div> : <span className="health-rhythm-missing" aria-label={nutrition.status === 'connected' ? 'No diary entries' : nutritionStatus(nutrition.status)}>—</span>}</td>)}</tr>
          <tr><th scope="row">Sleep<small>Your entries · hours</small></th>{days.map(d => <td key={d.date} data-selected={d.date === day.date}>{d.sleep !== null ? <div className="health-rhythm-bar health-rhythm-bar--sleep"><span style={{height:`${d.sleep/sleepMax*100}%`}}/><strong>{d.sleep}h</strong></div> : <span className="health-rhythm-missing" aria-label="Sleep not logged">—</span>}</td>)}</tr>
          <tr><th scope="row">Energy<small>Your entries · out of 5</small></th>{days.map(d => <td key={d.date} data-selected={d.date === day.date}>{d.energy !== null ? <span className="health-rhythm-energy" aria-label={`Energy ${d.energy} of 5`}>{[1,2,3,4,5].map(n => <i key={n} data-filled={n <= d.energy}/>)}<small>{d.energy}/5</small></span> : <span className="health-rhythm-missing" aria-label="Energy not logged">—</span>}</td>)}</tr>
        </tbody></table></div>
      <div className="health-rhythm-coverage"><span>{training.source === 'unavailable' ? 'Training unavailable' : `${trainingDays} training days`}</span><span>{nutrition.status === 'connected' ? `${loggedDays}/7 days with food entries` : nutritionStatus(nutrition.status)}</span><span>{sleepLogged}/7 sleep entries</span></div><p className="health-caption">Gaps are unlogged or unavailable, not zero. Sleep is shown on the check-in date and refers to the preceding night. Patterns here do not establish cause and effect.</p>
    </section>

    <section className="card health-panel health-fuel" aria-labelledby="fuel-title">
      <div className="health-panel__head"><div><span className="health-eyebrow">{day.date === today ? 'TODAY’S FUEL' : 'DAILY FUEL'}</span><h2 id="fuel-title">{healthDate(day.date, {weekday:'long', month:'short', day:'numeric'})}</h2></div><span className="health-source">{nutritionStatus(nutrition.status)}</span></div>
      <div className="health-fuel-layout"><div>
        <div className="health-fuel-metrics">{fuelMetrics.map(metric => {
          const value = day.nutrition?.totals[metric.key] ?? null;
          const percent = value !== null && metric.target !== null ? Math.min(100,value/metric.target*100) : null;
          return <div key={metric.key}><span className="health-stat-label">{metric.name}</span><strong>{value === null ? '—' : Math.round(value)}<small> {metric.unit}</small></strong><div className="health-fuel-track" data-unknown={percent === null} role={percent !== null ? 'meter' : undefined} aria-label={percent !== null ? `${metric.name} against your target` : undefined} aria-valuemin={percent !== null ? 0 : undefined} aria-valuemax={percent !== null ? metric.target! : undefined} aria-valuenow={percent !== null ? Math.min(value!,metric.target!) : undefined}>{percent !== null ? <span style={{width:`${percent}%`}}/> : null}</div><small className="health-caption">{metric.target !== null ? `of ${metric.target} ${metric.unit} target` : 'No target set'}</small></div>;
        })}</div>
        <p className="health-caption">{day.nutrition ? day.date === today ? 'Logged so far today. Entries may not represent your full intake.' : 'Logged intake; a diary with entries may still be incomplete.' : 'Intake is unknown until diary records are available. No nutrition values have been estimated.'}</p>
        <NutritionTargets key={`${goals.protein}-${goals.calories}`} goals={goals} onSave={onGoals}/>
        {nutrition.status !== 'connected' ? <div className="health-nutrition-pending"><strong>{nutritionStatus(nutrition.status)}</strong><p>{nutrition.status === 'authorization_required' ? 'Your application credentials are configured. Importing meals from your existing FatSecret account still requires diary authorization.' : nutrition.status === 'disabled' ? 'Nutrition API access is disabled in demo mode.' : nutrition.status === 'unavailable' ? 'Your food diary could not be loaded. Training and check-ins remain available.' : 'Connect FatSecret to bring meals and macros into this view.'}</p><a href="#health-sources">View data sources</a></div> : meals.length ? <div className="health-meal-list">{['breakfast','lunch','dinner','other'].map(meal => {
          const entries = meals.filter(m => m.meal.toLowerCase() === meal);
          return entries.length ? <details className="health-disclosure" key={meal}><summary>{meal === 'other' ? 'Other / snacks' : meal[0].toUpperCase()+meal.slice(1)}<span>{Math.round(entries.reduce((sum,m) => sum+m.totals.protein,0))} g protein · {Math.round(entries.reduce((sum,m) => sum+m.totals.calories,0))} kcal</span></summary>{entries.map(entry => <div className="health-meal-entry" key={entry.id}><strong>{entry.name}</strong><span>{entry.description}</span><small>{Math.round(entry.totals.protein)} g protein · {Math.round(entry.totals.calories)} kcal</small></div>)}</details> : null;
        })}</div> : <p className="health-muted health-empty">No food entries for this date. This does not mean zero intake.</p>}
      </div><aside className="health-day-context" aria-label="Training and recovery for the selected date"><h3>Alongside your fuel</h3><div><span className="health-stat-label">Training · {trainingLabel}</span>{day.workouts.length ? day.workouts.map(workout => <button className="health-day-workout" type="button" key={workout.id} onClick={() => onWorkout(workout)}><strong>{workout.title}</strong><small>{workout.minutes} min · Open sets →</small></button>) : <p>{day.trainingAvailable ? 'No workout logged' : 'Training unavailable'}</p>}</div><div className="health-day-checkins"><div><span className="health-stat-label">Sleep</span><strong>{day.sleep !== null ? hoursLabel(day.sleep) : '—'}</strong></div><div><span className="health-stat-label">Energy</span><strong>{day.energy !== null ? `${day.energy}/5` : '—'}</strong></div><div><span className="health-stat-label">Water</span><strong>{day.water !== null ? `${(day.water/1000).toLocaleString()} L` : '—'}</strong></div></div><p className="health-caption">Your entries · {day.sleep === null && day.energy === null ? 'No check-in for this date.' : 'Sleep refers to the preceding night.'}</p>{day.date === today ? <button type="button" className="health-text-btn" onClick={onCheckin}>Update today’s check-in →</button> : <button type="button" className="health-text-btn" onClick={() => navigate(0)}>Back to today →</button>}</aside></div>
    </section>
  </>;
}
