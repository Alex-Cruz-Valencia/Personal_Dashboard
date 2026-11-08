import type { NutritionDay, NutritionMeal, NutritionTotals } from '@/lib/nutrition';
import { DiaryAuthError } from './oauth1';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const invalid=()=>{throw new DiaryAuthError('invalid_response');};
const amount=(v:unknown)=>{if((typeof v!=='string'&&typeof v!=='number')||v==='') return invalid();const n=Number(v);return Number.isFinite(n)&&n>=0?n:invalid();};
export function nutritionDateInt(date:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(`${date}T00:00:00Z`))||new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date) return invalid();
  return Math.floor(Date.parse(`${date}T00:00:00Z`)/86400000);
}
const dateFromInt=(v:unknown)=>{const n=amount(v);if(!Number.isSafeInteger(n)||n>100000) return invalid();return new Date(n*86400000).toISOString().slice(0,10);};
const totals=(v:Record<string,unknown>):NutritionTotals=>({calories:amount(v.calories),protein:amount(v.protein),carbohydrate:amount(v.carbohydrate),fat:amount(v.fat)});
export function normalizeDiaryDay(value:unknown,date:string):NutritionDay {
  if(!object(value)||!('food_entries' in value)) return invalid();
  const root=value.food_entries;
  if(root!==null&&!object(root)) return invalid();
  const entries=object(root)?root.food_entry:undefined;
  if(entries!==undefined&&!Array.isArray(entries)) return invalid();
  const ids=new Set<string>();
  const meals: NutritionMeal[]=(entries??[]).map((entry:unknown)=>{
    if(!object(entry)||typeof entry.food_entry_id!=='string'||!entry.food_entry_id||typeof entry.food_entry_name!=='string'||typeof entry.food_entry_description!=='string'||typeof entry.meal!=='string'||dateFromInt(entry.date_int)!==date||ids.has(entry.food_entry_id)) return invalid();
    ids.add(entry.food_entry_id);
    const meal=entry.meal.toLowerCase();
    return {id:entry.food_entry_id,name:entry.food_entry_name,description:entry.food_entry_description,meal:['breakfast','lunch','dinner','other'].includes(meal)?meal:'other',totals:totals(entry)};
  });
  const sum:NutritionTotals={calories:0,protein:0,carbohydrate:0,fat:0};
  for(const meal of meals) for(const key of ['calories','protein','carbohydrate','fat'] as const) sum[key]=Math.round((sum[key]+meal.totals[key])*100)/100;
  return {date,totals:sum,meals,mealsLoaded:true};
}
export function normalizeDiaryMonth(value:unknown):NutritionDay[] {
  if(!object(value)||!('month' in value)) return invalid();
  if(value.month===null) return [];
  if(!object(value.month)) return invalid();
  const days=value.month.day??[];
  if(!Array.isArray(days)) return invalid();
  return days.map(day=>{if(!object(day)) return invalid();return {date:dateFromInt(day.date_int),totals:totals(day),meals:[],mealsLoaded:false};});
}
