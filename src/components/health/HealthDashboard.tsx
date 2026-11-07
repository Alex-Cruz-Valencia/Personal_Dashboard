"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  dayOffset, healthDate, HEALTH_STORAGE_KEY, hoursLabel, readHealthJournal,
  SAMPLE_LIFTS, SAMPLE_SLEEP, SAMPLE_WORKOUTS, validCheckin, validGoals, workoutSets, workoutVolume,
  type HealthCheckin, type HealthGoals, type HealthJournal, type HealthWorkout,
} from "@/lib/health";
import "./health.css";

type IconName = "strength" | "moon" | "sun" | "walk" | "drop" | "leaf" | "arrow" | "check";
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    strength: <><path d="m6 6 12 12M3 8l5-5M16 21l5-5M2 5l3-3M19 22l3-3" /><path d="m4 10 6-6M14 20l6-6" /></>,
    moon: <path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1" /></>,
    walk: <><circle cx="14" cy="4" r="2" /><path d="m9 22 3-7-3-4 3-4 3 4 4 1M5 12l4-1M12 15l4 3v4" /></>,
    drop: <path d="M12 3C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-12Z" />,
    leaf: <><path d="M20 4C8 2 2 9 7 16c7 5 14-1 13-12Z" /><path d="M4 21 16 9" /></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("health-journal-change", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("health-journal-change", callback); };
}
function snapshot() { try { return localStorage.getItem(HEALTH_STORAGE_KEY); } catch { return null; } }
function serverSnapshot() { return null; }
function persist(journal: HealthJournal): boolean {
  try {
    // Apply the retention limit on write as well as read.
    localStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(readHealthJournal(JSON.stringify(journal))));
    window.dispatchEvent(new Event("health-journal-change"));
    return true;
  } catch { return false; }
}

function Meter({ value, goal, label }: { value: number; goal: number; label: string }) {
  return <div className="health-meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(value, goal)} aria-valuetext={`${value.toLocaleString()} of ${goal.toLocaleString()}`}><span style={{ width: `${Math.min(100, Math.max(0, value / goal * 100))}%` }} /></div>;
}

/** Native dialog supplies focus containment, Escape and focus restoration. */
function HealthDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!opener.current && document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
    if (dialog && !dialog.open) dialog.showModal();
    // Removal dismisses the native dialog. Closing in effect cleanup would fire
    // onClose during React Strict Mode's setup/cleanup probe and immediately hide it.
    return () => { if (!dialog?.isConnected) opener.current?.focus(); };
  }, []);
  return <dialog ref={ref} className="health-dialog" aria-labelledby="health-dialog-title" onClose={onClose}>
    <div className="health-dialog__head"><h2 id="health-dialog-title">{title}</h2><button type="button" className="health-icon-btn" onClick={onClose} aria-label="Close dialog">×</button></div>
    {children}
  </dialog>;
}

function CheckinForm({ value, onSave, onDelete }: { value?: HealthCheckin; onSave: (value: HealthCheckin) => boolean; onDelete: () => void }) {
  const [energy, setEnergy] = useState(value?.energy ?? 3);
  const [error, setError] = useState("");
  return <form onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const checkin = {
      energy, soreness: form.get("soreness"), sleep: Number(form.get("sleep")),
      steps: form.get("steps") === "" ? null : Number(form.get("steps")),
      water: Number(form.get("water")), note: String(form.get("note") ?? "").trim(),
    };
    if (!validCheckin(checkin)) { setError("Check the values and try again."); return; }
    if (!onSave(checkin)) setError("This browser couldn't save your check-in. Your entries are still here; try again.");
  }}>
    <p className="health-muted">A minute for you. Saved only in this browser, separate from the sample data.</p>
    <fieldset className="health-energy"><legend>How is your energy today?</legend><div>{[1, 2, 3, 4, 5].map((number) => <label key={number} className={energy === number ? "is-selected" : ""}><input type="radio" name="energy" value={number} checked={energy === number} onChange={() => setEnergy(number)} /><span>{number}</span></label>)}</div><p><span>Running low</span><span>Full of energy</span></p></fieldset>
    <div className="health-form-grid">
      <label>Last night’s sleep <span>hours</span><input name="sleep" type="number" min="0" max="24" step="0.25" required defaultValue={value?.sleep ?? ""} placeholder="e.g. 7.5" /></label>
      <label>Muscle soreness<select name="soreness" defaultValue={value?.soreness ?? "low"}><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option></select></label>
      <label>Steps so far <span>optional</span><input name="steps" type="number" min="0" max="100000" step="1" defaultValue={value?.steps ?? ""} placeholder="e.g. 6200" /></label>
      <label>Water so far <span>mL</span><input name="water" type="number" min="0" max="20000" step="1" required defaultValue={value?.water ?? 0} /></label>
    </div>
    <label className="health-note-label">Anything to remember? <span>optional</span><textarea name="note" maxLength={500} rows={3} defaultValue={value?.note ?? ""} placeholder="What helped you feel good? What felt off?" /></label>
    {error ? <p role="alert" className="health-error">{error}</p> : null}
    <div className="health-form-actions">{value ? <button type="button" className="health-btn health-btn--quiet" onClick={onDelete}>Delete check-in</button> : null}<button className="health-btn health-btn--primary" type="submit">Save check-in</button></div>
  </form>;
}

function GoalsForm({ goals, onSave }: { goals: HealthGoals; onSave: (value: HealthGoals) => boolean }) {
  const [error, setError] = useState("");
  return <form onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = Object.fromEntries(["sessions", "sleep", "steps", "water"].map((key) => [key, Number(form.get(key))]));
    if (!validGoals(next)) { setError("Check the targets and try again."); return; }
    if (!onSave(next)) setError("This browser couldn't save your targets. Try again.");
  }}>
    <p className="health-muted">Start with targets that fit your life. These example values are editable; they aren’t personal recommendations.</p>
    <div className="health-form-grid">
      <label>Training <span>sessions / 7 days</span><input name="sessions" type="number" min="1" max="7" step="1" required defaultValue={goals.sessions} /></label>
      <label>Sleep <span>hours / night</span><input name="sleep" type="number" min="1" max="24" step="0.25" required defaultValue={goals.sleep} /></label>
      <label>Movement <span>steps / day</span><input name="steps" type="number" min="100" max="100000" step="1" required defaultValue={goals.steps} /></label>
      <label>Water <span>mL / day</span><input name="water" type="number" min="100" max="20000" step="1" required defaultValue={goals.water} /></label>
    </div>
    {error ? <p role="alert" className="health-error">{error}</p> : null}
    <div className="health-form-actions"><button className="health-btn health-btn--primary" type="submit">Save targets</button></div>
  </form>;
}

function StrengthChart({ today }: { today: string }) {
  const [selected, setSelected] = useState(0);
  const [weeks, setWeeks] = useState(4);
  const lift = SAMPLE_LIFTS[selected];
  const values = lift.values.slice(-weeks);
  const low = Math.floor((Math.min(...values) - 5) / 5) * 5;
  const high = Math.ceil((Math.max(...values) + 5) / 5) * 5;
  const x = (index: number) => 45 + index / (values.length - 1) * 320;
  const y = (value: number) => 142 - (value - low) / (high - low) * 110;
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const delta = values[values.length - 1] - values[0];
  return <section className="card health-panel health-strength" aria-labelledby="strength-title">
    <div className="health-panel__head"><h2 id="strength-title"><Icon name="strength" />Strength progress</h2><span className="health-source">Sample</span></div>
    <div className="health-chart-controls"><label className="health-sr-only" htmlFor="health-lift">Exercise</label><select id="health-lift" value={selected} onChange={(event) => setSelected(Number(event.target.value))}>{SAMPLE_LIFTS.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}</select><div className="health-segments" aria-label="Chart period">{[4, 12].map((period) => <button type="button" key={period} aria-pressed={weeks === period} onClick={() => setWeeks(period)}>{period} weeks</button>)}</div></div>
    <div className="health-lift-value"><strong>{values[values.length - 1]}<small> kg × {lift.reps}</small></strong><span>+{delta} kg over {weeks} weeks</span></div>
    <svg className="health-strength-chart" viewBox="0 0 400 182" role="img" aria-label={`${lift.name}, best working set for ${lift.reps} reps: ${values.map((value, index) => `${healthDate(dayOffset(today, -(values.length - 1 - index) * 7))}: ${value} kg`).join('; ')}`}>
      {[low, (low + high) / 2, high].map((value) => <g key={value}><line x1="45" x2="384" y1={y(value)} y2={y(value)} className="health-gridline" /><text x="0" y={y(value) + 4}>{value}</text></g>)}
      <polygon points={`45,142 ${points} 365,142`} className="health-chart-fill" />
      <polyline points={points} fill="none" className="health-chart-line" />
      {values.map((value, index) => <circle key={index} cx={x(index)} cy={y(value)} r="3.5" className="health-chart-dot"><title>{`${healthDate(dayOffset(today, -(values.length - 1 - index) * 7))}: ${value} kg × ${lift.reps}`}</title></circle>)}
      <text x="45" y="174">{healthDate(dayOffset(today, -(weeks - 1) * 7))}</text><text x="365" y="174" textAnchor="end">{healthDate(today)}</text>
    </svg>
    <p className="health-caption">Best working set each week, compared at the same rep count.</p>
  </section>;
}

function WorkoutDetail({ workout, today }: { workout: HealthWorkout; today: string }) {
  return <><p className="health-muted">Sample workout · {healthDate(dayOffset(today, -workout.daysAgo))} · {workout.minutes} min · {workoutSets(workout)} working sets</p><div className="health-workout-detail">{workout.exercises.map((exercise) => <div key={exercise.name}><strong>{exercise.name}</strong><span>{exercise.sets.length} × {exercise.sets[0].reps} · {exercise.sets[0].weight} kg</span></div>)}</div><p className="health-caption">Total load moved: {workoutVolume(workout).toLocaleString()} kg. This is example data, not a workout prescription.</p></>;
}

export function HealthDashboard({ today }: { today: string }) {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const journal = useMemo(() => readHealthJournal(raw), [raw]);
  const checkin = journal.days[today];
  const { goals } = journal;
  const [dialog, setDialog] = useState<"checkin" | "goals" | HealthWorkout | null>(null);
  const [notice, setNotice] = useState("");
  const sleepAverage = SAMPLE_SLEEP.reduce((sum, hours) => sum + hours, 0) / SAMPLE_SLEEP.length;
  const sleepGap = Math.max(0, Math.round((goals.sleep - sleepAverage) * 60));
  const nightsAtTarget = SAMPLE_SLEEP.filter((hours) => hours >= goals.sleep).length;
  const sessions = SAMPLE_WORKOUTS.length;
  const sessionsLeft = Math.max(0, goals.sessions - sessions);
  const trainingMinutes = SAMPLE_WORKOUTS.reduce((sum, workout) => sum + workout.minutes, 0);
  const bench = SAMPLE_LIFTS[0];
  const strengthGain = bench.values[bench.values.length - 1] - bench.values[bench.values.length - 4];
  const recentDays = Array.from({ length: 7 }, (_, index) => dayOffset(today, index - 6));
  const checkinCount = recentDays.filter((date) => journal.days[date]).length;
  const saved = (next: HealthJournal, message: string) => {
    if (!persist(next)) return false;
    setNotice(message); setDialog(null); return true;
  };
  const workoutRow = (workout: HealthWorkout) => <button key={workout.id} type="button" className="health-workout" onClick={() => setDialog(workout)}>
    <span className="health-workout__date"><small>{healthDate(dayOffset(today, -workout.daysAgo), { month: "short" })}</small><strong>{healthDate(dayOffset(today, -workout.daysAgo), { day: "numeric" })}</strong></span>
    <span className="health-workout__name"><strong>{workout.title}</strong><small>{workout.exercises.length} exercises · {workoutSets(workout)} sets · {workout.minutes} min</small></span><Icon name="arrow" />
  </button>;
  return <main className="health" id="health-main">
    <header className="health-titlebar">
      <div><h1>Health</h1><p>{healthDate(today, { weekday: "long", month: "long", day: "numeric" })}</p></div>
      <div className="health-header__actions"><button className="health-btn health-btn--quiet" type="button" onClick={() => setDialog("goals")}>Edit targets</button><button className="health-btn health-btn--primary" type="button" onClick={() => setDialog("checkin")}>{checkin ? "Edit check-in" : "Daily check-in"}</button></div>
    </header>

    <div className="health-preview-note"><span>Training, strength & sleep: sample data · Check-ins: your entries</span><a href="#health-sources">Sources</a></div>

    <section className="card health-overview" aria-label="Health at a glance">
      <div><span className="health-stat-label">Training</span><strong>{sessions}<small> / {goals.sessions} sessions</small></strong><span className="health-stat-note">{sessionsLeft ? `${sessionsLeft} session${sessionsLeft === 1 ? "" : "s"} to your target` : "Target met"}</span><span className="health-caption">Last 7 days · Sample</span></div>
      <div><span className="health-stat-label">Strength</span><strong>+{strengthGain}<small> kg</small></strong><span className="health-stat-note">Bench press · same 8 reps</span><span className="health-caption">Over 4 weeks · Sample</span></div>
      <div><span className="health-stat-label">Sleep</span><strong>{hoursLabel(sleepAverage)}</strong><span className="health-stat-note">{sleepGap ? `${sleepGap} min below ${hoursLabel(goals.sleep)} target` : `At your ${hoursLabel(goals.sleep)} target`}</span><span className="health-caption">Nightly average · 7 nights · Sample</span></div>
      <div><span className="health-stat-label">Energy</span><strong>{checkin ? <>{checkin.energy}<small> / 5</small></> : <span className="health-no-value">Not logged</span>}</strong><button type="button" className="health-text-btn" onClick={() => setDialog("checkin")}>{checkin ? "Edit today’s check-in" : "How do you feel today?"}</button><span className="health-caption">Today · Your entry</span></div>
    </section>

    <div className="health-main-grid">
      <StrengthChart today={today} />
      <section className="card health-panel health-priorities" aria-labelledby="priorities-title">
        <div className="health-panel__head"><h2 id="priorities-title">What matters now</h2></div>
        <div className="health-priority"><span className="health-priority__label">Consistency <small>Sample</small></span><p>{sessionsLeft ? `${sessionsLeft} more session${sessionsLeft === 1 ? "" : "s"} to your training target.` : "Your training target is met."}</p><span className="health-caption">{sessions} sessions in the last 7 days.</span><a className="health-text-btn" href="#health-training">Review your training <Icon name="arrow" /></a></div>
        <div className="health-priority"><span className="health-priority__label">Rest <small>Sample</small></span><p>{nightsAtTarget} of 7 nights reached your sleep target.</p><a className="health-text-btn" href="#health-sleep">See the pattern <Icon name="arrow" /></a></div>
        <div className="health-priority"><span className="health-priority__label">How you feel <small>Your entry</small></span><p>{!checkin ? "A check-in adds the part the charts can’t tell." : checkin.energy <= 2 ? "You logged lower energy today." : checkin.energy >= 4 ? "You logged good energy today." : "You logged steady energy today."}</p>{checkin ? <span className="health-caption">Soreness: {checkin.soreness} · Sleep: {hoursLabel(checkin.sleep)}</span> : null}<button type="button" className="health-text-btn" onClick={() => setDialog("checkin")}>{checkin ? "Update your check-in" : "Add your check-in"} <Icon name="arrow" /></button></div>
      </section>

      <section className="card health-panel" id="health-training" aria-labelledby="training-title">
        <div className="health-panel__head"><h2 id="training-title">Training consistency</h2><span className="health-source">Sample · Hevy preview</span></div>
        <p className="health-panel__intro">{healthDate(recentDays[0])}–{healthDate(today)} · {trainingMinutes} min across {sessions} sessions</p>
        <div className="health-training-week" aria-label="Sample training, last seven days">{recentDays.map((date, index) => {
          const workout = SAMPLE_WORKOUTS.find((item) => item.daysAgo === 6 - index);
          return <div key={date} className={index === 6 ? "is-today" : ""}><span>{healthDate(date, { weekday: "short" })}</span>{workout ? <button type="button" aria-label={`${workout.title}, ${healthDate(date)}, sample workout`} onClick={() => setDialog(workout)}><Icon name="check" /></button> : <span className="health-rest" aria-label="No sample workout">—</span>}<small>{index === 6 ? "Today" : workout ? workout.title.startsWith("Upper") ? "Upper" : "Lower" : "Rest"}</small></div>;
        })}</div>
        <div className="health-section-label"><h3>Latest session</h3><span>Open for exercises</span></div>
        {workoutRow(SAMPLE_WORKOUTS[0])}
        <details className="health-disclosure"><summary>Earlier sessions <span>{SAMPLE_WORKOUTS.length - 1} workouts</span></summary><div className="health-workouts">{SAMPLE_WORKOUTS.slice(1).map(workoutRow)}</div></details>
      </section>

      <section className="card health-panel" id="health-sleep" aria-labelledby="sleep-title">
        <div className="health-panel__head"><h2 id="sleep-title">Sleep consistency</h2><span className="health-source">Sample</span></div>
        <p className="health-panel__intro">{nightsAtTarget} of 7 nights at your {hoursLabel(goals.sleep)} target</p>
        <div className="health-sleep-chart" role="img" aria-label={`Sample sleep for the last seven nights: ${SAMPLE_SLEEP.map(hoursLabel).join(', ')}. Target ${hoursLabel(goals.sleep)}.`}>
          <div className="health-sleep-chart__target" style={{ bottom: `${Math.min(100, goals.sleep / Math.max(10, goals.sleep) * 100)}%` }}><span>Target</span></div>
          {SAMPLE_SLEEP.map((hours, index) => <div className="health-sleep-chart__day" key={index}><span className="health-sleep-chart__value" style={{ bottom: `${hours / Math.max(10, goals.sleep) * 100}%` }}>{hours}h</span><div style={{ height: `${hours / Math.max(10, goals.sleep) * 100}%` }} data-met={hours >= goals.sleep} /><span className="health-sleep-chart__label">{healthDate(dayOffset(today, index - 6), { weekday: "narrow" })}</span></div>)}
        </div><p className="health-caption">Last 7 nights · Sleep duration</p>
      </section>
    </div>

    <section className="card health-panel" aria-labelledby="foundations-title">
      <div className="health-panel__head"><h2 id="foundations-title">Today’s basics</h2><button type="button" className="health-text-btn" onClick={() => setDialog("checkin")}>{checkin ? "Update" : "Log today"} <Icon name="arrow" /></button></div>
      <div className="health-basics-grid">
        <div className="health-foundation"><div><span>Movement</span><strong>{checkin?.steps != null ? checkin.steps.toLocaleString() : "—"}<small> / {goals.steps.toLocaleString()} steps</small></strong></div>{checkin?.steps != null ? <Meter value={checkin.steps} goal={goals.steps} label="Today's manually logged steps" /> : <p className="health-caption">Not logged today</p>}</div>
        <div className="health-foundation"><div><span>Water</span><strong>{checkin ? (checkin.water / 1000).toLocaleString() : "—"}<small> / {(goals.water / 1000).toLocaleString()} L</small></strong></div>{checkin ? <Meter value={checkin.water} goal={goals.water} label="Today's manually logged water in milliliters" /> : <p className="health-caption">Not logged today</p>}</div>
      </div>
      {checkin?.note ? <p className="health-personal-note health-basics-note">Your note: {checkin.note}</p> : null}
      <p className="health-caption">Your entries · Targets are editable</p>
    </section>

    {Object.keys(journal.days).length > 0 ? <details className="health-disclosure health-journal-disclosure"><summary>Check-in history <span>{checkinCount} in the last 7 days</span></summary><div className="health-journal">{Object.entries(journal.days).sort(([a], [b]) => b.localeCompare(a)).slice(0, 7).map(([date, entry]) => <div key={date}><strong>{healthDate(date)}</strong><span>Energy {entry.energy}/5 · {hoursLabel(entry.sleep)} sleep · {entry.soreness} soreness</span>{entry.note ? <p>{entry.note}</p> : null}</div>)}</div></details> : null}

    <details className="health-disclosure health-connections" id="health-sources"><summary>Sources & what’s next <span>Hevy · sleep & activity · nutrition</span></summary><div className="health-connections__items"><span><strong>Hevy</strong><small>Sample workouts and strength. Not connected.</small></span><span><strong>Sleep & activity</strong><small>Sleep is sample data. Steps are logged manually.</small></span><span><strong>Nutrition</strong><small>Meals and protein tracking will come later.</small></span></div></details>
    <p className="health-storage-note">Your check-ins and targets stay in this browser · Up to 90 daily entries · No device sync</p>
    <p className="health-live-notice" role="status">{notice}</p>

    {dialog ? <HealthDialog title={dialog === "checkin" ? "Today’s check-in" : dialog === "goals" ? "Your health targets" : dialog.title} onClose={() => setDialog(null)}>
      {dialog === "checkin" ? <CheckinForm value={checkin} onSave={(value) => saved({ ...journal, days: { ...journal.days, [today]: value } }, "Today’s check-in saved on this device.")} onDelete={() => {
        const days = { ...journal.days }; delete days[today];
        if (!saved({ ...journal, days }, "Today’s check-in deleted.")) setNotice("This browser couldn't delete your check-in. Please try again.");
      }} /> : dialog === "goals" ? <GoalsForm goals={goals} onSave={(value) => saved({ ...journal, goals: value }, "Your targets are saved on this device.")} /> : <WorkoutDetail workout={dialog} today={today} />}
    </HealthDialog> : null}
  </main>;
}
