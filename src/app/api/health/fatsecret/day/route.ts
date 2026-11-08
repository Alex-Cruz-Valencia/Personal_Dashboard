import { NextResponse } from 'next/server';
import { rejectCrossSite } from '@/lib/request-guard';
import { getFatSecretDay } from '@/lib/fatsecret/data';
import { nutritionDateInt } from '@/lib/fatsecret/normalize';
import { DiaryAuthError } from '@/lib/fatsecret/oauth1';
import { resolveLocation } from '@/lib/location';
import { isoDateInZone } from '@/lib/time';
import { dayOffset } from '@/lib/health';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  const blocked=rejectCrossSite(request);if(blocked) return blocked;
  const headers={'Cache-Control':'private, no-store'};
  try {
    const date=new URL(request.url).searchParams.get('date')??'';
    nutritionDateInt(date);
    const today=isoDateInZone(new Date(),(await resolveLocation()).timezone);
    if(date<dayOffset(today,-83)||date>today) return NextResponse.json({error:'Date outside the available twelve-week history.'},{status:400,headers});
    return NextResponse.json({day:await getFatSecretDay(date)},{headers});
  } catch(error) {return NextResponse.json({error:'Diary details could not be loaded.'},{status:error instanceof DiaryAuthError&&error.code==='invalid_response'?400:502,headers});}
}
