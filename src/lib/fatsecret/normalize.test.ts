import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { nutritionDateInt, normalizeDiaryDay, normalizeDiaryMonth } from './normalize';
const date='2026-11-07',date_int=nutritionDateInt(date);
const entry={food_entry_id:'1',food_entry_name:'Fixture lunch',food_entry_description:'Two servings',date_int:String(date_int),meal:'Lunch',number_of_units:'2',calories:'500',protein:'35',carbohydrate:'50',fat:'20'};
describe('food diary normalization',()=>{
  it('uses calendar dates exactly, rejects impossible dates, and never multiplies already-totalled entry nutrients',()=>{
    expect(()=>nutritionDateInt('2026-02-30')).toThrow();
    expect(normalizeDiaryDay({food_entries:{food_entry:[entry]}},date)).toMatchObject({date,mealsLoaded:true,totals:{protein:35,calories:500},meals:[{meal:'lunch',description:'Two servings'}]});
  });
  it('accepts documented empty shapes without fabricating records or optional nutrients',()=>{
    expect(normalizeDiaryDay({food_entries:null},date).meals).toEqual([]);
    expect(normalizeDiaryDay({food_entries:{}},date).meals).toEqual([]);
    expect(normalizeDiaryMonth({month:{}})).toEqual([]);
  });
  it('rejects duplicate entries, mismatched dates and missing nutrients rather than silently returning zero',()=>{
    for(const entries of [[entry,entry],[{...entry,date_int:date_int-1}],[{...entry,protein:null}]]) expect(()=>normalizeDiaryDay({food_entries:{food_entry:entries}},date)).toThrow();
  });
  it('marks monthly summaries as needing meal details and preserves real zero values',()=>{
    expect(normalizeDiaryMonth({month:{day:[{...entry,protein:'0'}]}})).toMatchObject([{date,totals:{protein:0,calories:500},meals:[],mealsLoaded:false}]);
  });
});
