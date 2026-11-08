import type { TrainingData } from './health';

export const TRAINING_DAYS_PER_WEEK = 5;
export const REST_WEEKDAYS = [3, 5] as const; // Current plan: Wednesday and Friday.
const names=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const patterns=[/\b(?:sunday|sun)\b/i,/\b(?:monday|mon)\b/i,/\b(?:tuesday|tue|tues)\b/i,/\b(?:wednesday|wed|weds)\b/i,/\b(?:thursday|thu|thur|thurs)\b/i,/\b(?:friday|fri)\b/i,/\b(?:saturday|sat)\b/i];
export function workoutSchedule(date:string,routines:TrainingData['routines']) {
  const weekday=new Date(`${date}T12:00:00Z`).getUTCDay();
  const restDay=(REST_WEEKDAYS as readonly number[]).includes(weekday);
  return {weekday:names[weekday],restDay,known:routines!==null,routines:restDay?[]:(routines??[]).filter(r=>patterns[weekday]?.test(r.name))};
}
