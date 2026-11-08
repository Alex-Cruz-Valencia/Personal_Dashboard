import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { DiaryAuthError, exchangeDiaryToken } from '@/lib/fatsecret/oauth1';
import { consumePendingDiary, writeDiaryTokens } from '@/lib/fatsecret/token-store';
import { STATE_COOKIE } from '../route';

export const dynamic='force-dynamic';
export async function GET(request:NextRequest) {
  const home=new URL('/health/connect/fatsecret',request.url);
  let status='invalid_callback';
  try {
    const state=request.cookies.get(STATE_COOKIE)?.value??'';
    const query=new URL(request.url).searchParams;
    const token=query.get('oauth_token'),verifier=query.get('oauth_verifier');
    if(!/^[a-f0-9]{64}$/.test(state)) throw new DiaryAuthError('authentication');
    const pending=await consumePendingDiary(state);
    if(!pending || !token || !verifier || query.getAll('oauth_token').length!==1 || query.getAll('oauth_verifier').length!==1 || Buffer.byteLength(token)!==Buffer.byteLength(pending.token) || !timingSafeEqual(Buffer.from(token),Buffer.from(pending.token))) throw new DiaryAuthError('authentication');
    const tokens=await exchangeDiaryToken(pending,verifier);
    await writeDiaryTokens(tokens);
    status='connected';
  } catch(error) { status=error instanceof DiaryAuthError?error.code:'storage_unavailable'; }
  home.searchParams.set('status',status);
  const response=NextResponse.redirect(home,303);
  response.cookies.set(STATE_COOKIE,'',{maxAge:0,path:'/api/auth/fatsecret',httpOnly:true,sameSite:'lax',secure:new URL(request.url).protocol==='https:'});
  response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer');
  return response;
}
