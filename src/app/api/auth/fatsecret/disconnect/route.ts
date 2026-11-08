import { NextResponse } from 'next/server';
import { rejectCrossSite } from '@/lib/request-guard';
import { clearDiaryTokens } from '@/lib/fatsecret/token-store';
export async function POST(request:Request) {
  const blocked=rejectCrossSite(request);if(blocked) return blocked;
  const target=new URL('/health/connect/fatsecret',request.url);
  try {await clearDiaryTokens();target.searchParams.set('status','disconnected');}
  catch {target.searchParams.set('status','storage_unavailable');}
  const response=NextResponse.redirect(target,303);response.headers.set('Cache-Control','private, no-store');return response;
}
