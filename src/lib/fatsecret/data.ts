import 'server-only';
import { createHash } from 'node:crypto';
import { config, forceMock } from '@/lib/config';
import { dayOffset } from '@/lib/health';
import type { NutritionData, NutritionDay } from '@/lib/nutrition';
import { readDiaryTokens, clearDiaryTokens } from './token-store';
import { DiaryAuthError, readDiaryResource, type DiaryTokens } from './oauth1';
import { normalizeDiaryDay, normalizeDiaryMonth, nutritionDateInt } from './normalize';

const FIVE_MINUTES=300000;
let cached:{key:string;until:number;data:NutritionData}|null=null;
let inFlight:{key:string;value:Promise<NutritionData>}|null=null;
let retryAt=0;
let retryKey='';
const daily=new Map<string,{until:number;day:NutritionDay}>();
const fingerprint=(tokens:DiaryTokens)=>createHash('sha256').update(tokens.token+'\0'+tokens.secret).digest('hex');
export function diaryConfigured() {return Boolean(config.fatsecret.consumerKey&&config.fatsecret.consumerSecret);}

export async function getFatSecretDay(date:string):Promise<NutritionDay> {
  nutritionDateInt(date);
  if(forceMock) throw new DiaryAuthError('disabled');
  const tokens=await readDiaryTokens();if(!tokens) throw new DiaryAuthError('authentication');
  const key=fingerprint(tokens)+':'+date;
  const old=daily.get(key);if(old&&old.until>Date.now()) return old.day;
  try {
    const day=normalizeDiaryDay(await readDiaryResource('day',nutritionDateInt(date),tokens),date);
    for(const [key,item] of daily) if(item.until<=Date.now()) daily.delete(key);
    daily.set(key,{until:Date.now()+FIVE_MINUTES,day});
    return day;
  } catch(error) {if(error instanceof DiaryAuthError&&error.code==='authentication') {await clearDiaryTokens();cached=null;daily.clear();}throw error;}
}

/** Read-only user diary. Nutrition records stay in expiring RAM, never Redis/files. */
export async function getFatSecretNutrition(today:string):Promise<NutritionData> {
  if(forceMock) return {status:'disabled',days:{}};
  if(!diaryConfigured()) return {status:config.fatsecret.clientId&&config.fatsecret.clientSecret?'authorization_required':'not_configured',days:{}};
  let tokens:DiaryTokens|null;
  try {tokens=await readDiaryTokens();} catch {return {status:'unavailable',days:{}};}
  if(!tokens) {cached=null;daily.clear();return {status:'authorization_required',days:{}};}
  const key=fingerprint(tokens)+':'+today;
  if(cached?.key===key&&cached.until>Date.now()) return cached.data;
  if(retryKey===key&&Date.now()<retryAt) return {status:'unavailable',days:{}};
  if(inFlight?.key===key) return inFlight.value;
  const load=async():Promise<NutritionData>=>{
    try {
      const from=dayOffset(today,-83);
      const monthDates:string[]=[];
      let month=from.slice(0,7)+'-01';
      while(month<=today) {monthDates.push(month);const d=new Date(month+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);month=d.toISOString().slice(0,10);}
      const [months,current]=await Promise.all([
        Promise.all(monthDates.map(async date=>normalizeDiaryMonth(await readDiaryResource('month',nutritionDateInt(date),tokens!)))),
        getFatSecretDay(today),
      ]);
      const days:Record<string,NutritionDay>={};
      for(const day of months.flat()) if(day.date>=from&&day.date<=today) {if(days[day.date]) throw new DiaryAuthError('invalid_response');days[day.date]=day;}
      // An empty diary is not zero intake: omit days with no entries.
      if(current.meals.length) days[today]=current;else delete days[today];
      const data:NutritionData={status:'connected',days};
      cached={key,until:Date.now()+FIVE_MINUTES,data};return data;
    } catch(error) {
      cached=null;
      if(error instanceof DiaryAuthError&&error.code==='authentication') {try {await clearDiaryTokens();} catch {return {status:'unavailable',days:{}};}daily.clear();return {status:'authorization_required',days:{}};}
      retryKey=key;retryAt=Date.now()+60000;return {status:'unavailable',days:{}};
    }
  };
  const value=load();inFlight={key,value};
  try{return await value;}finally{if(inFlight?.value===value) inFlight=null;}
}
