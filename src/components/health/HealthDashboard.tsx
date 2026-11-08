"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  dayOffset, healthDate, HEALTH_STORAGE_KEY, hoursLabel, readHealthJournal,
  SAMPLE_SLEEP, displayWeight, muscleSets, validCheckin, validGoals, workoutSets, workoutVolume,
  type HealthCheckin, type HealthGoals, type HealthJournal, type HealthWorkout, type TrainingData,
} from "@/lib/health";
import { ConnectedHealth } from "./ConnectedHealth";
import type { NutritionData } from "@/lib/nutrition";
import { TodayActions } from "./TodayActions";
import { WaterBottles } from "./WaterBottles";
import { ProgressOverview } from "./ProgressOverview";
import { overallProgress } from "@/lib/health-progress";
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
    localStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(readHealthJournal(JSON.stringify({ ...journal, trainingScheduleVersion: 1, nutritionGoalVersion: 1 }))));
    window.dispatchEvent(new Event("health-journal-change"));
    return true;
  } catch { return false; }
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

function CheckinForm({ value, initialWater, initialBottleMl, onSave, onDelete }: { value?: HealthCheckin; initialWater: number; initialBottleMl: number; onSave: (value: HealthCheckin, bottleMl: number) => boolean; onDelete: () => void }) {
  const [energy, setEnergy] = useState(value?.energy ?? 3);
  const [water, setWater] = useState(initialWater);
  const [bottleMl, setBottleMl] = useState(initialBottleMl);
  const [error, setError] = useState("");
  return <form onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const checkin = {
      energy, soreness: form.get("soreness"), sleep: Number(form.get("sleep")),
      steps: form.get("steps") === "" ? null : Number(form.get("steps")),
      water, note: String(form.get("note") ?? "").trim(),
    };
    if (!validCheckin(checkin)) { setError("Check the values and try again."); return; }
    if (!onSave(checkin, bottleMl)) setError("This browser couldn't save your check-in. Your entries are still here; try again.");
  }}>
    <p className="health-muted">A minute for you. Saved only in this browser. These entries are separate from Hevy.</p>
    <fieldset className="health-energy"><legend>How is your energy today?</legend><div>{[1, 2, 3, 4, 5].map((number) => <label key={number} className={energy === number ? "is-selected" : ""}><input type="radio" name="energy" value={number} checked={energy === number} onChange={() => setEnergy(number)} /><span>{number}</span></label>)}</div><p><span>Running low</span><span>Full of energy</span></p></fieldset>
    <div className="health-form-grid">
      <label>Last night’s sleep <span>hours</span><input name="sleep" type="number" min="0" max="24" step="0.25" required defaultValue={value?.sleep ?? ""} placeholder="e.g. 7.5" /></label>
      <label>Muscle soreness<select name="soreness" defaultValue={value?.soreness ?? "low"}><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option></select></label>
      <label>Steps so far <span>optional</span><input name="steps" type="number" min="0" max="100000" step="1" defaultValue={value?.steps ?? ""} placeholder="e.g. 6200" /></label>

    </div>
    <fieldset className="health-water-field"><legend>Water so far</legend><WaterBottles water={water} onChange={setWater} bottleMl={bottleMl} onSizeChange={setBottleMl}/></fieldset>
    <label className="health-note-label">Anything to remember? <span>optional</span><textarea name="note" maxLength={500} rows={3} defaultValue={value?.note ?? ""} placeholder="What helped you feel good? What felt off?" /></label>
    {error ? <p role="alert" className="health-error">{error}</p> : null}
    <div className="health-form-actions">{value ? <button type="button" className="health-btn health-btn--quiet" onClick={onDelete}>Delete check-in</button> : null}<button className="health-btn health-btn--primary" type="submit">Save check-in</button></div>
  </form>;
}

function GoalsForm({ goals, initialBottleMl, onSave }: { goals: HealthGoals; initialBottleMl: number; onSave: (value: HealthGoals, bottleMl: number) => boolean }) {
  const [water, setWater] = useState(goals.water);
  const [bottleMl, setBottleMl] = useState(initialBottleMl);
  const [error, setError] = useState("");
  return <form onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = { ...Object.fromEntries(["sessions", "sleep", "steps"].map((key) => [key, Number(form.get(key))])), water };
    if (!validGoals(next)) { setError("Check the targets and try again."); return; }
    if (!onSave(next, bottleMl)) setError("This browser couldn't save your targets. Try again.");
  }}>
    <p className="health-muted">Start with targets that fit your life. These starting targets come from the app, not Hevy. Your edits stay in this browser; they aren’t personal recommendations.</p>
    <div className="health-form-grid">
      <label>Training <span>training days / 7 days</span><input name="sessions" type="number" min="1" max="7" step="1" required defaultValue={goals.sessions} /></label>
      <label>Sleep <span>hours / night</span><input name="sleep" type="number" min="1" max="24" step="0.25" required defaultValue={goals.sleep} /></label>
      <label>Movement <span>steps / day</span><input name="steps" type="number" min="100" max="100000" step="1" required defaultValue={goals.steps} /></label>

    </div>
    <fieldset className="health-water-field"><legend>Daily water target</legend><WaterBottles water={water} onChange={setWater} bottleMl={bottleMl} onSizeChange={setBottleMl}/></fieldset>
    {error ? <p role="alert" className="health-error">{error}</p> : null}
    <div className="health-form-actions"><button className="health-btn health-btn--primary" type="submit">Save targets</button></div>
  </form>;
}

function WorkoutDetail({ workout, today, unit, label }: { workout: HealthWorkout; today: string; unit: "kg" | "lbs"; label: string }) {
  const description = (set: HealthWorkout["exercises"][number]["sets"][number], kind?: string) => {
    const parts: string[] = [];
    if (set.weight !== null) parts.push(`${displayWeight(set.weight, unit)} ${unit}${kind === "bodyweight_assisted_reps" ? " assistance" : ""}`);
    if (set.reps !== null) parts.push(`${set.reps} reps`);
    if (set.duration != null) parts.push(`${Math.round(set.duration)} sec`);
    if (set.distance != null) parts.push(`${set.distance.toLocaleString()} m`);
    if (set.rpe != null) parts.push(`RPE ${set.rpe}`);
    return parts.join(" · ") || "No metrics logged";
  };
  const volume = workoutVolume(workout);
  return <><p className="health-muted">{label} · {healthDate(workout.date ?? dayOffset(today, -workout.daysAgo))} · {workout.minutes} min · {workoutSets(workout)} working sets</p>
    {workout.notes ? <p className="health-personal-note">{workout.notes}</p> : null}
    <div className="health-workout-detail">{workout.exercises.map((exercise, i) => <section className="health-exercise-detail" key={`${exercise.id ?? exercise.name}:${i}`}><h3>{exercise.name}</h3>{exercise.notes ? <p className="health-caption">{exercise.notes}</p> : null}{exercise.sets.map((set, index) => <div className="health-set" key={index}><span>{index + 1}{set.type && set.type !== "normal" ? ` · ${set.type === "warmup" ? "warm-up" : set.type}` : ""}</span><span>{description(set, exercise.kind)}</span></div>)}</section>)}</div>
    {volume > 0 ? <p className="health-caption">External load × reps: {displayWeight(volume, unit).toLocaleString()} {unit}. Warm-ups and assisted movements excluded.</p> : null}
  </>;
}

export function HealthDashboard({ today, timezone, training, nutrition }: { today: string; timezone: string; training: TrainingData; nutrition: NutritionData }) {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const journal = useMemo(() => readHealthJournal(raw), [raw]);
  const checkin = journal.days[today];
  const { goals } = journal;
  const water = journal.waterDays?.[today] ?? checkin?.water ?? 0;
  const [dialog, setDialog] = useState<"checkin" | "goals" | HealthWorkout | null>(null);
  const [fuelView, setFuelView] = useState(0);
  const [notice, setNotice] = useState("");
  const demo = training.source === "sample";
  const available = training.source !== "unavailable";
  const sourceLabel = demo ? "Sample" : training.source === "cached" ? "Hevy · last sync" : !available ? "Hevy unavailable" : "Hevy";
  const recentDays = Array.from({ length: 7 }, (_, i) => dayOffset(today, i - 6));
  const week = training.workouts.filter((w) => w.daysAgo >= 0 && w.daysAgo <= 6);
  const sleepValues = demo ? SAMPLE_SLEEP : recentDays.map((date) => journal.days[date]?.sleep ?? null);
  const loggedSleep = sleepValues.filter((v): v is number => v !== null);
  const sleepAverage = loggedSleep.length ? loggedSleep.reduce((sum, hours) => sum + hours, 0) / loggedSleep.length : null;
  const sleepGap = sleepAverage !== null ? Math.max(0, Math.round((goals.sleep - sleepAverage) * 60)) : null;
  const nightsAtTarget = loggedSleep.filter((hours) => hours >= goals.sleep).length;
  const sessions = week.length;
  const trainingDays = new Set(week.map(w => w.date)).size;
  const sessionsLeft = Math.max(0, goals.sessions - trainingDays);
  const trainingMinutes = week.reduce((sum, w) => sum + w.minutes, 0);
  const progress = overallProgress(training.lifts, today, 4);
  const muscles = muscleSets(week);
  const checkinCount = recentDays.filter((date) => journal.days[date]).length;
  const saved = (next: HealthJournal, message: string) => {
    if (!persist(next)) return false;
    setNotice(message); setDialog(null); return true;
  };
  const workoutRow = (workout: HealthWorkout) => <button key={workout.id} type="button" className="health-workout" onClick={() => setDialog(workout)}>
    <span className="health-workout__date"><small>{healthDate(workout.date!, { month: "short" })}</small><strong>{healthDate(workout.date!, { day: "numeric" })}</strong></span>
    <span className="health-workout__name"><strong>{workout.title}</strong><small>{workout.exercises.length} exercises · {workoutSets(workout)} sets · {workout.minutes} min</small></span><Icon name="arrow" />
  </button>;
  return <main className="health" id="health-main">
    <header className="health-titlebar"><div><h1>Health</h1><p>{healthDate(today, { weekday: "long", month: "long", day: "numeric" })}</p></div><div className="health-header__actions"><button className="health-btn health-btn--quiet" type="button" onClick={() => setDialog("goals")}>Edit targets</button><button className="health-btn health-btn--primary" type="button" onClick={() => setDialog("checkin")}>{checkin ? "Edit check-in" : "Daily check-in"}</button></div></header>

    {training.message ? <p className="source-notice" role="status">{training.message}</p> : null}

    <TodayActions today={today} training={training} nutrition={nutrition} journal={journal} onWorkout={setDialog} onCheckin={() => setDialog("checkin")} onTargets={() => setDialog("goals")} onNutritionGoals={(nutritionGoals) => { if (!persist({ ...journal, nutritionGoals })) return false; setNotice("Daily nutrition targets saved on this device."); return true; }} onNutritionDetails={() => setFuelView(v => v + 1)} onWater={(amount) => { if (persist({ ...journal, waterDays: { ...journal.waterDays, [today]: amount } })) setNotice("Water saved on this device."); else setNotice("This browser could not save your water. Please try again."); }} onPlan={(plan) => { const workoutPlans = { ...journal.workoutPlans }; if (plan) workoutPlans[today] = plan; else delete workoutPlans[today]; if (!persist({ ...journal, workoutPlans })) return false; setNotice("Today’s workout plan saved on this device."); return true; }}/>
    <div className="health-insights-heading" id="health-insights"><span className="health-eyebrow">THE BIGGER PICTURE</span><h2>Patterns & progress</h2><p className="health-caption">Review your consistency and history when you need more context.</p></div>
    <div className="health-preview-note"><span>{demo ? "Training & sleep: sample data" : available ? `${sourceLabel} · ${training.workouts.length} workouts · Synced ${training.syncedAt ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: timezone }).format(new Date(training.syncedAt)) : "—"}` : "Hevy unavailable"} · Check-ins: your entries</span><a href="#health-sources">Sources</a></div>
    <section className="card health-overview health-overview--visual" aria-label="Health at a glance">
      <div><span className="health-stat-label">Training rhythm</span><div className="health-ring" role="img" aria-label={available ? `${trainingDays} of ${goals.sessions} target training days in the last seven days` : 'Training unavailable'}><svg viewBox="0 0 100 100" aria-hidden="true"><circle className="health-ring-track" cx="50" cy="50" r="42"/><circle className="health-ring-fill" cx="50" cy="50" r="42" pathLength="100" strokeDasharray={`${available ? Math.min(100, trainingDays / goals.sessions * 100) : 0} 100`}/></svg><strong>{available ? trainingDays : '—'}<small> / {goals.sessions}</small></strong></div><span className="health-stat-note">{available ? sessionsLeft ? `${sessionsLeft} training days to your weekly target` : 'Weekly target met' : 'Awaiting Hevy'}</span><span className="health-caption">Last 7 days · {sourceLabel}</span></div>
      <div><span className="health-stat-label">Strength direction</span><strong className="health-strength-takeaway">{!available ? 'Unavailable' : progress.median === null ? 'Building a baseline' : progress.median > .5 ? 'Trending up' : progress.median < -.5 ? 'Trending down' : 'Holding steady'}</strong><div className="health-direction-track" role="img" aria-label={`${progress.improving} improving, ${progress.steady} steady, ${progress.declining} declining exercises`}>{progress.rows.length ? <><span data-direction="up" style={{flex: progress.improving}}/><span data-direction="steady" style={{flex: progress.steady}}/><span data-direction="down" style={{flex: progress.declining}}/></> : null}</div><span className="health-stat-note">{progress.median === null ? available ? 'Repeat comparable sets to reveal a trend.' : 'Awaiting Hevy' : `${progress.median > 0 ? '+' : ''}${progress.median.toFixed(1)}% typical change · ${progress.improving} up, ${progress.steady} steady, ${progress.declining} down`}</span><span className="health-caption">{progress.rows.length} exercises compared · {progress.unpaired} need more data<br/>Last 4 weeks · {sourceLabel}</span></div>
      <div><span className="health-stat-label">Sleep rhythm</span><strong>{sleepAverage !== null ? hoursLabel(sleepAverage) : '—'}<small> average</small></strong><div className="health-mini-nights" role="img" aria-label={`${loggedSleep.length} nights logged of seven; target ${goals.sleep} hours`}>{sleepValues.map((hours, i) => <div key={i} title={`${healthDate(recentDays[i])}: ${hours === null ? 'not logged' : hoursLabel(hours)}`}><span data-empty={hours === null} style={{height: hours === null ? '8px' : `${Math.max(3,Math.min(100, hours / Math.max(10,goals.sleep,...loggedSleep) * 100))}%`}}/></div>)}</div><span className="health-stat-note">{sleepGap === null ? 'Add sleep to reveal your rhythm' : sleepGap > 0 ? `${sleepGap} min below your sleep target` : 'At your sleep target'}</span><span className="health-caption">{loggedSleep.length} of 7 nights · {demo ? 'Sample' : 'Your entries'}</span></div>
      <div><span className="health-stat-label">Energy today</span><strong>{checkin ? ['','Low','Low','Steady','Good','High'][checkin.energy] : <span className="health-no-value">Not logged</span>}</strong><div className="health-energy-dots" role="img" aria-label={checkin ? `Energy ${checkin.energy} out of 5` : 'Energy not logged'}>{[1,2,3,4,5].map(n => <span key={n} data-active={!!checkin && n <= checkin.energy}/>)}</div><button type="button" className="health-text-btn" onClick={() => setDialog("checkin")}>{checkin ? 'Update your energy' : 'How do you feel today?'} <Icon name="arrow" /></button><span className="health-caption">Today · Your entry</span></div>
    </section>

    <ConnectedHealth key={fuelView} today={today} training={training} journal={journal} nutrition={nutrition} onWorkout={setDialog} onCheckin={() => setDialog("checkin")} onGoals={(nutritionGoals) => { if (!persist({ ...journal, nutritionGoals })) return false; setNotice("Nutrition targets saved on this device."); return true; }}/>
    <ProgressOverview training={training} today={today} onWorkout={setDialog}/>
    <div className="health-main-grid health-main-grid--visual">
      <section className="card health-panel" id="health-training" aria-labelledby="training-title"><div className="health-panel__head"><h2 id="training-title">Training consistency</h2><span className="health-source">{sourceLabel}</span></div><p className="health-panel__intro">{healthDate(recentDays[0])}–{healthDate(today)} · {available ? `${trainingMinutes} min across ${sessions} sessions` : "Unavailable"}</p>
        <div className="health-training-week" aria-label="Training, last seven days">{recentDays.map((date, index) => {
          const daily = training.workouts.filter((w) => w.date === date);
          return <div key={date} className={index === 6 ? "is-today" : ""}><span>{healthDate(date, { weekday: "short" })}</span>{daily.length ? <button type="button" aria-label={`${daily.length} session${daily.length === 1 ? "" : "s"}, ${healthDate(date)}. Latest: ${daily[0].title}`} onClick={() => setDialog(daily[0])}><Icon name="check" /></button> : <span className="health-rest" aria-label={available ? "No logged workout" : "Unavailable"}>—</span>}<small>{index === 6 ? "Today" : daily.length ? `${daily.length} session${daily.length === 1 ? "" : "s"}` : available ? "Rest" : "—"}</small></div>;
        })}</div>
        {training.workouts.length ? <><div className="health-section-label"><h3>Latest session</h3><span>Open for all sets</span></div>{workoutRow(training.workouts[0])}<details className="health-disclosure"><summary>Earlier sessions <span>{training.workouts.length - 1} workouts</span></summary><div className="health-workouts health-workouts--history">{training.workouts.slice(1).map(workoutRow)}</div></details></> : <p className="health-muted health-empty">{available ? "No workouts logged in Hevy yet." : "Your workout history will appear when Hevy is available."}</p>}
        {muscles.length ? <details className="health-disclosure"><summary>Sets by muscle <span>Last 7 days</span></summary><div className="health-muscles">{muscles.map(({ muscle, sets }) => <div key={muscle}><span>{muscle.replaceAll("_", " ")}</span><strong>{sets} sets</strong></div>)}</div><p className="health-caption">Primary muscle only. Warm-ups excluded; secondary muscles are not double-counted.</p></details> : null}
      </section>

      <section className="card health-panel" id="health-sleep" aria-labelledby="sleep-title"><div className="health-panel__head"><h2 id="sleep-title">Sleep consistency</h2><span className="health-source">{demo ? "Sample" : "Your entries"}</span></div><p className="health-panel__intro">{loggedSleep.length ? `${nightsAtTarget} of ${loggedSleep.length} logged nights at your ${hoursLabel(goals.sleep)} target` : "Log sleep in your daily check-in to start a trend."}</p>
        {loggedSleep.length ? <><div className="health-sleep-chart" role="img" aria-label={`Sleep in the last seven nights: ${sleepValues.map((v) => v === null ? 'not logged' : hoursLabel(v)).join(', ')}. Target ${hoursLabel(goals.sleep)}.`}>
          <div className="health-sleep-chart__target" style={{ bottom: `${goals.sleep / Math.max(10, goals.sleep, ...loggedSleep) * 100}%` }}><span>Target</span></div>
          {sleepValues.map((hours, i) => <div className="health-sleep-chart__day" key={i}><span className="health-sleep-chart__value" style={{ bottom: `${(hours ?? 0) / Math.max(10, goals.sleep, ...loggedSleep) * 100}%` }}>{hours === null ? "—" : `${hours}h`}</span><div style={{ height: `${(hours ?? 0) / Math.max(10, goals.sleep, ...loggedSleep) * 100}%` }} data-met={hours !== null && hours >= goals.sleep} /><span className="health-sleep-chart__label">{healthDate(recentDays[i], { weekday: "narrow" })}</span></div>)}
        </div><p className="health-caption">Last 7 nights · Missing nights are not counted as zero.</p></> : <button className="health-text-btn health-empty" type="button" onClick={() => setDialog("checkin")}>Log last night’s sleep <Icon name="arrow" /></button>}
      </section>
    </div>

    {Object.keys(journal.days).length > 0 ? <details className="health-disclosure health-journal-disclosure"><summary>Check-in history <span>{checkinCount} in the last 7 days</span></summary><div className="health-journal">{Object.entries(journal.days).sort(([a], [b]) => b.localeCompare(a)).slice(0, 7).map(([date, entry]) => <div key={date}><strong>{healthDate(date)}</strong><span>Energy {entry.energy}/5 · {hoursLabel(entry.sleep)} sleep · {entry.soreness} soreness</span>{entry.note ? <p>{entry.note}</p> : null}</div>)}</div></details> : null}
    {!demo && training.routines !== null ? <details className="health-disclosure"><summary>Your routines <span>{training.routines.length} saved in Hevy</span></summary><div className="health-muscles">{training.routines.length ? training.routines.map((r) => <div key={r.id}><span>{r.name}</span><strong>{r.exercises} exercises</strong></div>) : <p className="health-caption">No saved routines.</p>}</div></details> : null}
    <details className="health-disclosure" id="health-sources"><summary>Sources & what’s next <span>Hevy · check-ins · nutrition</span></summary><div className="health-connections__items"><span><strong>Hevy</strong><small>{demo ? "Sample workouts and strength. No live connection." : !available ? "Hevy isn’t reachable. Training data is temporarily unavailable." : `${sourceLabel}: ${training.workouts.length} workouts loaded. Refreshes about every 5 minutes while open.`}</small></span><span><strong>Sleep & activity</strong><small>{demo ? "Sample sleep." : "Sleep, energy, soreness and steps come from your check-ins. Water can also be logged directly by tapping bottles."}</small></span><span><strong>Nutrition · FatSecret</strong><small>{nutrition.status === "authorization_required" ? "Application credentials configured. Your food diary still needs account authorization; meals and macros are not syncing yet." : nutrition.status === "connected" ? "Your FatSecret food diary is shown by calendar date alongside training and check-ins." : nutrition.status === "disabled" ? "FatSecret is disabled in demo mode." : nutrition.status === "unavailable" ? "FatSecret could not load your diary. Missing nutrition is not counted as zero." : "FatSecret will provide meals and nutrition after it is connected."}</small></span></div></details>
    <p className="health-storage-note">Check-ins and targets stay in this browser · Hevy reads are cached briefly on the server · No writes to Hevy</p><p className="health-live-notice" role="status">{notice}</p>
    {dialog ? <HealthDialog title={dialog === "checkin" ? "Today’s check-in" : dialog === "goals" ? "Your health targets" : dialog.title} onClose={() => setDialog(null)}>
      {dialog === "checkin" ? <CheckinForm value={checkin} initialWater={water} initialBottleMl={journal.bottleMl ?? 500} onSave={(value, bottleMl) => saved({ ...journal, bottleMl, waterDays: { ...journal.waterDays, [today]: value.water }, days: { ...journal.days, [today]: value } }, "Today’s check-in saved on this device.")} onDelete={() => { const days = { ...journal.days }; delete days[today]; if (!saved({ ...journal, days }, "Today’s check-in deleted.")) setNotice("This browser couldn't delete your check-in. Please try again."); }} /> : dialog === "goals" ? <GoalsForm goals={goals} initialBottleMl={journal.bottleMl ?? 500} onSave={(value, bottleMl) => saved({ ...journal, bottleMl, goals: value }, "Your targets are saved on this device.")} /> : <WorkoutDetail workout={dialog} today={today} unit={training.weightUnit} label={sourceLabel} />}
    </HealthDialog> : null}
  </main>;
}
