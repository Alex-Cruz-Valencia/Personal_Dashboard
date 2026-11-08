import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TodayActions } from '@/components/health/TodayActions';
import { workoutSchedule } from './health-schedule';
import { validNutritionGoals } from './nutrition';
import { HEALTH_GOALS, dayOffset, readHealthJournal, type HealthJournal, type TrainingData } from './health';

const training: TrainingData = { source:'live',workouts:[],lifts:[],routines:[{id:'upper',name:'Upper body',exercises:6}],weightUnit:'lbs',syncedAt:null,message:null };
const actions = {onWorkout:()=>{},onPlan:()=>true,onWater:()=>{},onCheckin:()=>{},onTargets:()=>{},onNutritionDetails:()=>{},onNutritionGoals:()=>true};
const journal: HealthJournal = {goals:HEALTH_GOALS,days:{}};
describe('today-first health actions', () => {
  it('matches full weekday names and abbreviations without guessing from old workout history', () => {
    const routines=[{id:'sat',name:'Saturday - Legs',exercises:6},{id:'sat2',name:'SAT. - Upper',exercises:5},{id:'sun',name:'Sunday - Push',exercises:6},{id:'unrelated',name:'Satisfaction workout',exercises:3}];
    expect(workoutSchedule('2026-11-07',routines).routines.map(r=>r.id)).toEqual(['sat','sat2']);
    expect(workoutSchedule('2026-11-08',routines).routines.map(r=>r.id)).toEqual(['sun']);
    expect(workoutSchedule('2026-11-09',routines).routines).toEqual([]);
  });
  it('enforces Wednesday and Friday rest even if older routines still carry those names', () => {
    const routines=[{id:'wed',name:'Wednesday lower',exercises:6},{id:'fri',name:'Friday pull',exercises:5}];
    expect(workoutSchedule('2026-11-04',routines)).toMatchObject({restDay:true,routines:[]});
    expect(workoutSchedule('2026-11-06',routines)).toMatchObject({restDay:true,routines:[]});
    expect(workoutSchedule('2026-11-07',null).known).toBe(false);
  });
  it('migrates the previous weekly target to five days once and preserves later edits', () => {
    expect(HEALTH_GOALS.sessions).toBe(5);
    expect(readHealthJournal(JSON.stringify({goals:{...HEALTH_GOALS,sessions:4},days:{}})).goals.sessions).toBe(5);
    expect(readHealthJournal(JSON.stringify({trainingScheduleVersion:1,goals:{...HEALTH_GOALS,sessions:6},days:{}})).goals.sessions).toBe(6);
  });
  it('applies the owner’s explicit nutrition goals once and preserves subsequent changes', () => {
    const legacy={goals:HEALTH_GOALS,days:{},nutritionGoals:{protein:null,calories:null,carbohydrate:250}};
    expect(readHealthJournal(JSON.stringify(legacy)).nutritionGoals).toEqual({protein:200,calories:2600,carbohydrate:250});
    const edited={...legacy,nutritionGoalVersion:1,nutritionGoals:{protein:null,calories:2400}};
    expect(readHealthJournal(JSON.stringify(edited)).nutritionGoals).toEqual({protein:null,calories:2400});
    const html=renderToStaticMarkup(createElement(TodayActions,{today:'2026-11-07',training,nutrition:{status:'connected',days:{'2026-11-07':{date:'2026-11-07',totals:{protein:80,calories:1400,carbohydrate:150,fat:40},meals:[]}}},journal:readHealthJournal(null),...actions}));
    expect(html).toContain('120 g protein to your target');
    expect(html).toContain('1200 kcal remaining');
    expect(html).toContain('aria-valuemax="200"');
    expect(html).toContain('aria-valuemax="2600"');
  });
  it('shows the weekday routine automatically and omits the workout card on a rest day', () => {
    const routines=[{id:'sat',name:'Saturday - Legs',exercises:6}];
    const props={training:{...training,routines},nutrition:{status:'authorization_required' as const,days:{}},journal,...actions};
    const html=renderToStaticMarkup(createElement(TodayActions,{today:'2026-11-07',...props}));
    expect(html).toContain('Saturday - Legs');expect(html).toContain('today-workout-title');
    const rest=renderToStaticMarkup(createElement(TodayActions,{today:'2026-11-06',...props}));
    expect(rest).not.toContain('today-workout-title');expect(rest).toContain('Friday · Rest day');
  });
  it('supports all four nutrition goals without changing legacy saved targets', () => {
    expect(validNutritionGoals({protein:140,calories:2200})).toBe(true);
    expect(validNutritionGoals({protein:140,calories:2200,carbohydrate:250,fat:70})).toBe(true);
    expect(validNutritionGoals({protein:140,calories:2200,carbohydrate:-1,fat:70})).toBe(false);
    const nutrition={status:'connected' as const,days:{'2026-11-07':{date:'2026-11-07',totals:{protein:150,calories:2100,carbohydrate:250,fat:70},meals:[]}}};
    const html=renderToStaticMarkup(createElement(TodayActions,{today:'2026-11-07',training,nutrition,journal:{...journal,nutritionGoals:{protein:140,calories:2200,carbohydrate:250,fat:70}},...actions}));
    expect(html).toContain('Protein target reached');expect(html).toContain('10 g over target');expect(html).toContain('100 kcal remaining');expect(html).toContain('aria-label="Carbs today"');expect(html).toContain('aria-label="Fat today"');
  });
  it('hides unmatched workout cards and keeps water targets user-defined', () => {
    const html=renderToStaticMarkup(createElement(TodayActions,{today:'2026-11-07',training,nutrition:{status:'authorization_required',days:{}},journal,...actions}));
    expect(html).not.toContain('today-workout-title');
    expect(html).not.toContain('Upper body');
    expect(html).toContain('2.5 L left to log');
    expect(html).toContain('Awaiting diary access');
    expect(html).not.toContain('health-today-macros');
    expect(html).not.toContain('No data available');
  });
  it('retains plans independently of check-ins and bounds/sanitizes dated plan storage', () => {
    const plans=Object.fromEntries(Array.from({length:100},(_,i)=>[dayOffset('2026-11-07',-i),{kind:'rest'}]));
    const result=readHealthJournal(JSON.stringify({workoutPlans:{...plans,'wrong-date':{kind:'rest'},'2026-11-08':{kind:'routine',routineId:'upper',title:'Upper body'},'2026-11-09':{kind:'routine',routineId:'',title:'Bad'}}}));
    expect(Object.keys(result.workoutPlans!)).toHaveLength(90);
    expect(result.workoutPlans!['2026-11-08']).toEqual({kind:'routine',routineId:'upper',title:'Upper body'});
    expect(result.workoutPlans!['2026-11-09']).toBeUndefined();
    expect(result.workoutPlans!['wrong-date']).toBeUndefined();
    expect(result.days).toEqual({});
  });
  it('separates a planned rest day from workouts that were actually logged', () => {
    const html=renderToStaticMarkup(createElement(TodayActions,{today:'2026-11-07',training:{...training,workouts:[{id:'one',title:'Logged workout',date:'2026-11-07',daysAgo:0,minutes:40,exercises:[]},{id:'old',title:'Yesterday session',date:'2026-11-06',daysAgo:1,minutes:30,exercises:[]}]},nutrition:{status:'authorization_required',days:{}},journal:{...journal,workoutPlans:{'2026-11-07':{kind:'rest'}},waterDays:{'2026-11-07':1000}},...actions}));
    expect(html).toContain('1 session logged');
    expect(html).toContain('Logged workout');
    expect(html).not.toContain('Yesterday session');
    expect(html).toContain('1.5 L left to log');
    expect(html).not.toContain('Rest day planned');
  });
  it('shows only today’s real nutrition and does not imply a completed diary', () => {
    const html=renderToStaticMarkup(createElement(TodayActions,{today:'2026-11-07',training,nutrition:{status:'connected',days:{'2026-11-07':{date:'2026-11-07',totals:{protein:80,calories:1400,carbohydrate:150,fat:40},meals:[]}}},journal:{...journal,nutritionGoals:{protein:140,calories:2200},waterDays:{'2026-11-07':3000},workoutPlans:{'2026-11-07':{kind:'routine',routineId:'upper',title:'Upper body'}}},...actions}));
    expect(html).toContain('60 g protein to your target');
    expect(html).toContain('Logged so far, not your full day');
    expect(html).toContain('Your logged target is met');
    expect(html).toContain('aria-label="Protein today"');
    expect(html).toContain('57%');
    expect(html).toContain('Edit daily nutrition targets');
  });
});
