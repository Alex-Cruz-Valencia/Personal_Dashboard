import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const settings=vi.hoisted(()=>({config:{fatsecret:{consumerKey:'fake-consumer',consumerSecret:'fake-secret',redirectUri:'http://localhost:3000/api/auth/fatsecret/callback'}},features:{fatsecretDiary:true}}));
vi.mock('server-only',()=>({}));vi.mock('@/lib/config',()=>settings);
import { oauth1Header, requestDiaryToken, exchangeDiaryToken, readDiaryResource, diaryCallbackUrl } from './oauth1';
const fetchMock=vi.fn();
beforeEach(()=>{vi.stubGlobal('fetch',fetchMock);fetchMock.mockReset();settings.config.fatsecret.consumerKey='fake-consumer';settings.features.fatsecretDiary=true;settings.config.fatsecret.redirectUri='http://localhost:3000/api/auth/fatsecret/callback';});
afterEach(()=>vi.unstubAllGlobals());
describe('FatSecret delegated OAuth',()=>{
  it('matches the published OAuth 1.0 photos example signature',()=>{
    const header=oauth1Header('GET','http://photos.example.net/photos',{file:'vacation.jpg',size:'original'},{key:'dpf43f3p2l4k3l03',secret:'kd94hf93k423kf44'},{token:'nnch734d00sl2jdk',secret:'pfkkdhi9sl3r4s00'},{},'kllo9940pd9333jh','1191242096');
    expect(header).toContain('oauth_signature="tR3%2BTy81lMeYAr%2FFid0kMTYa%2FWM%3D"');
  });
  it('uses the documented form/query auth transport and never sends token secrets',async()=>{
    fetchMock.mockResolvedValueOnce(new Response('oauth_token=temp&oauth_token_secret=temp-secret&oauth_callback_confirmed=true'));
    const pending=await requestDiaryToken();expect(pending.token).toBe('temp');
    expect(fetchMock.mock.calls[0][0]).toBe('https://authentication.fatsecret.com/oauth/request_token');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({method:'POST',cache:'no-store',redirect:'error',signal:expect.any(AbortSignal)});
    expect(fetchMock.mock.calls[0][1].body.get('oauth_callback')).toBe('http://localhost:3000/api/auth/fatsecret/callback');
    expect(fetchMock.mock.calls[0][1].body.get('oauth_signature')).toBeTruthy();
    fetchMock.mockResolvedValueOnce(new Response('oauth_token=access&oauth_token_secret=access-secret'));
    expect(await exchangeDiaryToken(pending,'verifier')).toEqual({token:'access',secret:'access-secret'});
    const exchange=new URL(fetchMock.mock.calls[1][0]);
    expect(exchange.origin+exchange.pathname).toBe('https://authentication.fatsecret.com/oauth/access_token');
    expect(exchange.searchParams.get('oauth_verifier')).toBe('verifier');
    expect(exchange.href).not.toContain('temp-secret');
    expect(exchange.href).not.toContain('fake-secret');
  });
  it('blocks missing credentials, forced demo and unsafe callback configuration before network calls',async()=>{
    settings.config.fatsecret.consumerKey='';await expect(requestDiaryToken()).rejects.toMatchObject({code:'credentials_required'});
    settings.config.fatsecret.consumerKey='fake-consumer';settings.features.fatsecretDiary=false;await expect(requestDiaryToken()).rejects.toMatchObject({code:'disabled'});
    settings.config.fatsecret.redirectUri='http://foreign.example/api/auth/fatsecret/callback';expect(()=>diaryCallbackUrl()).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('sanitizes failures and rejects unconfirmed or duplicate request tokens',async()=>{
    fetchMock.mockRejectedValueOnce(new Error('fake-secret'));await expect(requestDiaryToken()).rejects.toMatchObject({code:'unavailable',message:'FatSecret diary: unavailable'});
    fetchMock.mockResolvedValueOnce(new Response('oauth_token=a&oauth_token_secret=b'));await expect(requestDiaryToken()).rejects.toMatchObject({code:'invalid_response'});
    fetchMock.mockResolvedValueOnce(new Response('oauth_token=a&oauth_token=a&oauth_token_secret=b&oauth_callback_confirmed=true'));await expect(requestDiaryToken()).rejects.toMatchObject({code:'invalid_response'});
  });
  it('reads only whitelisted diary resources and recognizes authentication errors inside HTTP 200',async()=>{
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({error:{code:9,message:'fake-secret'}})));
    await expect(readDiaryResource('day',20000,{token:'access',secret:'private'})).rejects.toMatchObject({code:'authentication'});
    expect(fetchMock.mock.calls[0][0]).toBe('https://platform.fatsecret.com/rest/server.api');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(fetchMock.mock.calls[0][1].body.get('method')).toBe('food_entries.get.v2');
    expect(fetchMock.mock.calls[0][1].body.get('oauth_token')).toBe('access');
    expect(fetchMock.mock.calls[0][1].body.toString()).not.toContain('private');
  });
});
