"use client";

import { useState } from 'react';
import { hoursLabel, type HealthJournal, type HealthWorkout, type TodayWorkoutPlan, type TrainingData } from '@/lib/health';
import { workoutSchedule } from '@/lib/health-schedule';
import { PERSONAL_NUTRITION_GOALS, type NutritionData, type NutritionGoals } from '@/lib/nutrition';
import { WaterBottles } from './WaterBottles';
import { NutritionTargets } from './NutritionTargets';

export function TodayActions({today,training,nutrition,journal,onWorkout,onPlan,onWater,onCheckin,onTargets,onNutritionDetails,onNutritionGoals}: {
  today:string;training:TrainingData;nutrition:NutritionData;journal:HealthJournal;
  onWorkout:(workout:HealthWorkout)=>void;onPlan:(plan:TodayWorkoutPlan|null)=>boolean;
  onWater:(water:number)=>void;onCheckin:()=>void;onTargets:()=>void;onNutritionDetails:()=>void;onNutritionGoals:(goals:NutritionGoals)=>boolean;
}) {
  const [error,setError]=useState('');
  const checkin=journal.days[today];
  const schedule=workoutSchedule(today,training.routines);
  const savedPlan=journal.workoutPlans?.[today];
  const selected=savedPlan?.kind==='routine'&&schedule.routines.some(r=>r.id===savedPlan.routineId)?savedPlan.routineId:'';
  const routines=selected?schedule.routines.filter(r=>r.id===selected):schedule.routines;
  const workouts=training.workouts.filter(w=>w.date===today);
  const showWorkout=workouts.length>0||routines.length>0;
  const food=nutrition.status==='connected'?nutrition.days[today]:undefined;
  const water=journal.waterDays?.[today]??checkin?.water??0;
  const remaining=Math.max(0,journal.goals.water-water);
  const bottleMl=journal.bottleMl??500;
  const source=training.source==='sample'?'Sample':training.source==='cached'?'Hevy · last sync':'Hevy';
  const goals=journal.nutritionGoals??PERSONAL_NUTRITION_GOALS;
  const fields=[{key:'protein' as const,name:'Protein',unit:'g'},{key:'calories' as const,name:'Calories',unit:'kcal'},{key:'carbohydrate' as const,name:'Carbs',unit:'g'},{key:'fat' as const,name:'Fat',unit:'g'}];
  const goalCount=fields.filter(f=>goals[f.key]!=null).length;
  const round=(value:number)=>Math.round(value*10)/10;
  const nutritionMessage=nutrition.status==='authorization_required'?'FatSecret diary access is pending. Today’s meals and macros cannot sync yet.':nutrition.status==='disabled'?'FatSecret is disabled in demo mode.':nutrition.status==='unavailable'?'FatSecret could not load today’s diary.':nutrition.status==='connected'?'No meals logged for today yet. Log them in FatSecret to track today’s fuel.':'Connect your FatSecret diary to see today’s meals and macros.';
  return <section className="health-today" aria-labelledby="health-today-title">
    <div className="health-today-heading"><div><span className="health-eyebrow">START HERE</span><h2 id="health-today-title">Your priorities today</h2><p className="health-caption">{schedule.restDay?`${schedule.weekday} · Rest day. Focus on your fuel, water and check-in.`:'Your session, daily targets and water, all in one place.'}</p></div><a className="health-text-btn" href="#health-insights">See trends below ↓</a></div>
    <div className="health-today-grid" data-workout={showWorkout}>
      {showWorkout?<section className="card health-panel health-today-workout" aria-labelledby="today-workout-title"><div className="health-panel__head"><h3 id="today-workout-title">Today’s workout</h3><span className="health-source">{source}</span></div>
        <strong className="health-today-status">{routines.length===1?routines[0].name:routines.length?`${schedule.weekday} routines`:`${workouts.length} session${workouts.length===1?'':'s'} logged`}</strong>
        {routines.map(r=><div className="health-today-routine" key={r.id}>{routines.length>1?<strong>{r.name}</strong>:null}<p className="health-caption">{r.exercises} exercises · {workouts.length?'Planned routine':'Planned for today'}</p></div>)}
        {workouts.map(w=><button className="health-day-workout" type="button" key={w.id} onClick={()=>onWorkout(w)}><strong>{w.title}</strong><small>{w.minutes} min · Logged today · View sets →</small></button>)}
        {routines.length&&!workouts.length?<p className="health-caption">Your completed session will appear after you log it in Hevy.</p>:null}
        <a className="health-text-btn" href="https://hevy.com" target="_blank" rel="noreferrer">Open Hevy ↗</a>
        {schedule.routines.length>1?<label className="health-today-plan-label">Choose today’s routine<select value={selected} onChange={e=>{
          const r=schedule.routines.find(r=>r.id===e.target.value);
          setError(onPlan(r?{kind:'routine',routineId:r.id,title:r.name}:null)?'':'This browser could not save your choice. Please try again.');
        }}><option value="">Show all {schedule.weekday} routines</option>{schedule.routines.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>:null}
        <p className="health-caption">Matched by weekday in your routine names. Five training days: Sun, Mon, Tue, Thu, Sat. Rest: Wed & Fri.</p>{error?<p className="health-error" role="alert">{error}</p>:null}
      </section>:null}
      <section className="card health-panel health-today-nutrition" aria-labelledby="today-nutrition-title"><div className="health-panel__head"><h3 id="today-nutrition-title">Today’s nutrition</h3><span className="health-source">FatSecret</span></div>
        {food?<><strong className="health-today-status">{goals.protein?food.totals.protein>=goals.protein?'Protein target reached':`${round(goals.protein-food.totals.protein)} g protein to your target`:`${round(food.totals.protein)} g protein logged`}</strong><div className="health-today-macros">{fields.map(f=>{
          const value=food.totals[f.key],goal=goals[f.key]??null;
          const percent=goal!==null?value/goal*100:null;
          const difference=goal!==null?round(Math.abs(goal-value)):null;
          const status=goal===null?'Set a target below':value>goal?`${difference} ${f.unit} over target`:value===goal?'Target reached':`${difference} ${f.unit} remaining`;
          return <div key={f.key} data-primary={f.key==='protein'||f.key==='calories'}><span>{f.name}</span><strong>{round(value)}<small> {f.unit}{goal!==null?` / ${goal}`:''}</small></strong>{goal!==null?<><div className="health-goal-progress" role="meter" aria-label={`${f.name} today`} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(value,goal)} aria-valuetext={`${round(value)} of ${goal} ${f.unit}; ${Math.round(percent!)} percent; ${status}`}><span style={{width:`${Math.min(100,percent!)}%`}}/></div><span className="health-goal-status">{Math.round(percent!)}% · {status}</span></>:<span className="health-caption">{f.key==='protein'||f.key==='calories'?'No target set':'Logged total'}</span>}</div>;
        })}</div><p className="health-caption">{food.meals.length} food entries · Logged so far, not your full day’s intake.</p></>:<><strong className="health-today-status">{nutrition.status==='authorization_required'?'Awaiting diary access':nutrition.status==='connected'?'Ready when you log':'Diary not available'}</strong><p className="health-caption">{nutritionMessage}</p>{goalCount?<p className="health-today-targets">Your targets: {fields.filter(f=>goals[f.key]!=null).map(f=>`${goals[f.key]} ${f.unit} ${f.name.toLowerCase()}`).join(' · ')}</p>:null}</>}
        {!goalCount?<p className="health-caption">Add your daily goals below to see your progress and what remains. No nutrition targets are estimated.</p>:null}
        <NutritionTargets key={`${goals.protein}-${goals.calories}-${goals.carbohydrate}-${goals.fat}`} goals={goals} onSave={onNutritionGoals} compact/>
        {food?<p className="health-caption"><a href="https://platform.fatsecret.com">Powered by fatsecret Platform API</a></p>:null}
        <div className="health-today-nutrition-links">{nutrition.status!=='connected'?<a className="health-text-btn" href="/health/connect/fatsecret">Connect food diary →</a>:null}<a className="health-text-btn" href="https://www.fatsecret.com" target="_blank" rel="noreferrer">Open FatSecret ↗</a><a className="health-text-btn" href="#health-fuel" onClick={onNutritionDetails}>See today’s meals →</a></div>
      </section>
      <section className="card health-panel health-today-water" aria-labelledby="today-water-title"><div className="health-panel__head"><h3 id="today-water-title">Water today</h3><button className="health-text-btn" type="button" onClick={onTargets}>Edit target</button></div><strong className="health-today-status">{remaining===0?'Your logged target is met':`${(remaining/1000).toLocaleString()} L left to log`}</strong><p className="health-caption">Your target: {(journal.goals.water/1000).toLocaleString()} L · {Math.round(journal.goals.water/bottleMl*10)/10} bottles of {bottleMl} mL.</p><WaterBottles water={water} onChange={onWater} bottleMl={bottleMl} goal={journal.goals.water}/><button className="health-text-btn" type="button" onClick={onCheckin}>Change bottle size →</button><p className="health-caption">Based on your editable target and logged drinks.</p></section>
    </div>
    <section className="card health-today-checkin" aria-label="Today’s recovery check-in"><div><span className="health-stat-label">How are you feeling today?</span><p>{checkin?`Energy ${checkin.energy}/5 · ${hoursLabel(checkin.sleep)} / ${hoursLabel(journal.goals.sleep)} sleep · ${checkin.soreness} soreness`:'Add last night’s sleep and how you feel before you plan your day.'}</p></div><div className="health-today-checkin-actions">{checkin?.steps!==null&&checkin?.steps!==undefined?<span className="health-caption">{checkin.steps.toLocaleString()} / {journal.goals.steps.toLocaleString()} steps</span>:null}<button className="health-btn" type="button" onClick={onCheckin}>{checkin?'Update check-in':'Check in now'}</button></div></section>
    {checkin?.note?<p className="health-caption health-today-note">Your note: {checkin.note}</p>:null}
  </section>;
}
