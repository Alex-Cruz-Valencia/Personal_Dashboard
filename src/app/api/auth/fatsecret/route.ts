import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { rejectCrossSite } from '@/lib/request-guard';
import { requestDiaryToken, diaryAuthorizeUrl, DiaryAuthError } from '@/lib/fatsecret/oauth1';
import { savePendingDiary } from '@/lib/fatsecret/token-store';

export const dynamic='force-dynamic';
export const STATE_COOKIE='fatsecret_diary_state';
export async function POST(request:Request) {
  const blocked=rejectCrossSite(request);if(blocked) return blocked;
  try {
    const pending=await requestDiaryToken();
    const state=randomBytes(32).toString('hex');
    await savePendingDiary(state,pending);
    const response=NextResponse.redirect(diaryAuthorizeUrl(pending.token),303);
    response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer');
    response.cookies.set(STATE_COOKIE,state,{httpOnly:true,sameSite:'lax',secure:new URL(request.url).protocol==='https:',path:'/api/auth/fatsecret',maxAge:600});
    return response;
  } catch(error) {
    const code=error instanceof DiaryAuthError?error.code:'storage_unavailable';
    const home=new URL('/health/connect/fatsecret',request.url);home.searchParams.set('status',code);
    return NextResponse.redirect(home,303);
  }
}
