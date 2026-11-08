"use client";
import { useState } from 'react';
import { validNutritionGoals, type NutritionGoals } from '@/lib/nutrition';

export function NutritionTargets({goals,onSave,compact=false}:{goals:NutritionGoals;onSave:(goals:NutritionGoals)=>boolean;compact?:boolean}) {
  const [message,setMessage]=useState('');
  const [failed,setFailed]=useState(false);
  return <details className={`health-disclosure${compact?' health-nutrition-targets--compact':''}`}><summary>{compact?'Edit daily nutrition targets':'Set your nutrition targets'}<span>Saved in this browser</span></summary><form className="health-nutrition-targets" onSubmit={event=>{
    event.preventDefault();const form=new FormData(event.currentTarget);
    const amount=(name:string)=>form.get(name)===''?null:Number(form.get(name));
    const next={protein:amount('protein'),calories:amount('calories'),carbohydrate:amount('carbohydrate'),fat:amount('fat')};
    if(!validNutritionGoals(next)){setFailed(true);setMessage('Check your targets and try again.');return;}
    const saved=onSave(next);setFailed(!saved);setMessage(saved?'Targets saved. Leave a field blank to track without a target.':'This browser could not save your targets. Please try again.');
  }}><p className="health-caption">Enter your own daily goals. FatSecret supplies your intake; these goals are not imported or estimated. Blank means no target.</p><div>{[{key:'protein' as const,label:'Protein · g',max:1000},{key:'calories' as const,label:'Calories · kcal',max:20000},{key:'carbohydrate' as const,label:'Carbs · g',max:3000},{key:'fat' as const,label:'Fat · g',max:1000}].map(field=><label key={field.key}>{field.label}<input type="number" name={field.key} min="1" max={field.max} step="any" defaultValue={goals[field.key]??''} placeholder="Your target"/></label>)}<button className="health-btn" type="submit">Save targets</button></div><p className={failed?'health-error':'health-caption'} role={failed?'alert':'status'}>{message}</p></form></details>;
}
