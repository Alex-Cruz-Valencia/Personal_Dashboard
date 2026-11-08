import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks=vi.hoisted(()=>({request:vi.fn(),save:vi.fn(),consume:vi.fn(),exchange:vi.fn(),write:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('./oauth1',()=>({requestDiaryToken:mocks.request,exchangeDiaryToken:mocks.exchange,diaryAuthorizeUrl:(token:string)=>new URL('https://authentication.fatsecret.com/oauth/authorize?oauth_token='+token),DiaryAuthError:class extends Error{constructor(public code:string){super(code);}}}));
vi.mock('./token-store',()=>({savePendingDiary:mocks.save,consumePendingDiary:mocks.consume,writeDiaryTokens:mocks.write}));
import { POST, STATE_COOKIE } from '@/app/api/auth/fatsecret/route';
import { GET } from '@/app/api/auth/fatsecret/callback/route';
const state='a'.repeat(64);
const callback=(query:string,cookie=state)=>new NextRequest('http://localhost:3000/api/auth/fatsecret/callback?'+query,{headers:{cookie:`${STATE_COOKIE}=${cookie}`}});
beforeEach(()=>{for(const fn of Object.values(mocks)) fn.mockReset();mocks.request.mockResolvedValue({token:'temporary',secret:'temporary-secret'});mocks.consume.mockResolvedValue({token:'temporary',secret:'temporary-secret'});mocks.exchange.mockResolvedValue({token:'private-access',secret:'private-secret'});});
describe('browser-bound diary authorization',()=>{
  it('blocks cross-site connection attempts before issuing tokens',async()=>{
    const response=await POST(new Request('http://localhost:3000/api/auth/fatsecret',{method:'POST',headers:{origin:'https://foreign.example',host:'localhost:3000'}}));
    expect(response.status).toBe(403);expect(mocks.request).not.toHaveBeenCalled();
  });
  it('keeps the request secret server-side and sends only opaque HttpOnly state to the browser',async()=>{
    const response=await POST(new Request('http://localhost:3000/api/auth/fatsecret',{method:'POST'}));
    expect(response.status).toBe(303);expect(response.headers.get('location')).toBe('https://authentication.fatsecret.com/oauth/authorize?oauth_token=temporary');
    const cookie=response.headers.get('set-cookie')!;expect(cookie).toContain('HttpOnly');expect(cookie).toContain('SameSite=lax');expect(cookie).not.toContain('temporary-secret');
    expect(mocks.save).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/),{token:'temporary',secret:'temporary-secret'});
  });
  it('rejects missing browser state, mismatched request tokens and duplicate callback parameters',async()=>{
    await GET(callback('oauth_token=temporary&oauth_verifier=code',''));expect(mocks.consume).not.toHaveBeenCalled();
    await GET(callback('oauth_token=foreign&oauth_verifier=code'));
    await GET(callback('oauth_token=temporary&oauth_token=foreign&oauth_verifier=code'));
    expect(mocks.exchange).not.toHaveBeenCalled();expect(mocks.write).not.toHaveBeenCalled();
  });
  it('stores approved tokens without exposing them in callback output and rejects replays',async()=>{
    const response=await GET(callback('oauth_token=temporary&oauth_verifier=code'));
    expect(mocks.write).toHaveBeenCalledWith({token:'private-access',secret:'private-secret'});
    expect(response.headers.get('location')).toBe('http://localhost:3000/health/connect/fatsecret?status=connected');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    mocks.consume.mockResolvedValue(null);mocks.exchange.mockClear();await GET(callback('oauth_token=temporary&oauth_verifier=code'));
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
});
