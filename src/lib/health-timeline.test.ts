import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { healthWeek } from './health-timeline';
import { HEALTH_GOALS, readHealthJournal, type HealthJournal, type TrainingData } from './health';
import { validNutritionGoals, type NutritionData } from './nutrition';
import { ConnectedHealth } from '@/components/health/ConnectedHealth';

const training: TrainingData = { source:'live', workouts:[
  {id:'a',title:'Morning session',date:'2026-11-06',daysAgo:1,minutes:45,exercises:[]},
  {id:'b',title:'Evening session',date:'2026-11-06',daysAgo:1,minutes:30,exercises:[]},
],lifts:[],routines:[],weightUnit:'lbs',syncedAt:null,message:null };
const journal: HealthJournal = { goals:HEALTH_GOALS, days:{'2026-11-06':{energy:4,sleep:7.5,soreness:'low',steps:null,water:500,note:''}}, waterDays:{'2026-11-06':750} };
const nutrition: NutritionData = {status:'connected',days:{'2026-11-06':{date:'2026-11-06',totals:{protein:80,calories:1600,carbohydrate:200,fat:50},meals:[]}}};

describe('shared health timeline', () => {
  it('joins multiple workouts, nutrition and check-ins on the same local calendar date', () => {
    const week = healthWeek('2026-11-07',training,journal,nutrition);
    expect(week).toHaveLength(7);
    expect(week[0].date).toBe('2026-11-01');
    expect(week[5]).toMatchObject({date:'2026-11-06',sleep:7.5,energy:4,water:750,nutrition:{totals:{protein:80}}});
    expect(week[5].workouts.map(w => w.id)).toEqual(['a','b']);
    expect(week[6]).toMatchObject({sleep:null,energy:null,water:null,nutrition:null});
  });
  it('keeps unavailable sources unknown, even if a stale nutrition object is present', () => {
    const week = healthWeek('2026-11-07',{...training,source:'unavailable',workouts:[]},journal,{...nutrition,status:'authorization_required'});
    expect(week[5].nutrition).toBeNull();
    expect(week[5].trainingAvailable).toBe(false);
    expect(week[5].sleep).toBe(7.5);
  });
  it('preserves genuine zero records and handles a week crossing the year boundary', () => {
    const data: NutritionData = {status:'connected',days:{'2027-01-01':{date:'2027-01-01',totals:{protein:0,calories:0,carbohydrate:0,fat:0},meals:[]}}};
    const week = healthWeek('2027-01-02',training,{goals:HEALTH_GOALS,days:{},waterDays:{'2027-01-01':0}},data);
    expect(week[0].date).toBe('2026-12-27');
    expect(week[5].water).toBe(0);
    expect(week[5].nutrition?.totals.protein).toBe(0);
    expect(week[6].nutrition).toBeNull();
  });
  it('uses the owner’s goals, preserves edits, rejects malformed goals and retains check-ins', () => {
    expect(readHealthJournal(null).nutritionGoals).toEqual({protein:200,calories:2600});
    const data=readHealthJournal(JSON.stringify({...journal,nutritionGoalVersion:1,nutritionGoals:{protein:140,calories:null}}));
    expect(data.nutritionGoals).toEqual({protein:140,calories:null});
    expect(data.days['2026-11-06'].sleep).toBe(7.5);
    for(const goals of [{protein:-1,calories:null},{protein:'140',calories:2000},{protein:null,calories:Infinity},{protein:null}]) expect(validNutritionGoals(goals)).toBe(false);
    expect(validNutritionGoals({protein:null,calories:null})).toBe(true);
  });
  it('renders pending authorization with no invented macros and accessible date controls', () => {
    const html=renderToStaticMarkup(createElement(ConnectedHealth,{today:'2026-11-07',training,journal,nutrition:{status:'authorization_required',days:{}},onWorkout:()=>{},onCheckin:()=>{},onGoals:()=>true}));
    expect(html).toContain('Diary authorization pending');
    expect(html).toContain('No nutrition values have been estimated');
    expect(html).toContain('aria-label="View Nov 7, today"');
    expect(html).not.toContain('role="meter"');
    expect(html).toContain('1/7 sleep entries');
  });
  it('renders actual logged amounts, meal details and same-day workouts together', () => {
    const data: NutritionData={status:'connected',days:{'2026-11-06':{...nutrition.days['2026-11-06'],meals:[{id:'meal',name:'Fixture lunch',meal:'Lunch',description:'One serving',totals:{protein:35,calories:500,carbohydrate:50,fat:20}}]}}};
    const html=renderToStaticMarkup(createElement(ConnectedHealth,{today:'2026-11-06',training,journal:{...journal,nutritionGoals:{protein:140,calories:2200}},nutrition:data,onWorkout:()=>{},onCheckin:()=>{},onGoals:()=>true}));
    expect(html).toContain('Logged so far today');
    expect(html).toContain('Fixture lunch');
    expect(html).toContain('Morning session');expect(html).toContain('Evening session');
    expect(html).toContain('aria-valuenow="80"');
    expect(html).toContain('aria-valuemax="140"');
    expect(html).toContain('1/7 days with food entries');
  });
});
