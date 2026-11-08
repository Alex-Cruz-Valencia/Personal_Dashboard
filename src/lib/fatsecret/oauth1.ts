import 'server-only';
import { createHmac, randomBytes } from 'node:crypto';
import { config, features } from '@/lib/config';

export class DiaryAuthError extends Error {
  constructor(public readonly code: 'credentials_required' | 'disabled' | 'authentication' | 'rate_limited' | 'unavailable' | 'invalid_response' | 'configuration') { super(`FatSecret diary: ${code}`); }
}
export interface DiaryTokens { token: string; secret: string }
const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** RFC 5849 signature: encode, sort encoded key/value pairs, then sign once. */
export function oauth1Parameters(method: string, url: string, params: Record<string,string>, credentials: {key:string;secret:string}, tokens?: DiaryTokens, extras: Record<string,string> = {}, nonce = randomBytes(24).toString('hex'), timestamp = Math.floor(Date.now()/1000).toString()) {
  const oauth: Record<string,string> = {oauth_consumer_key:credentials.key,oauth_nonce:nonce,oauth_signature_method:'HMAC-SHA1',oauth_timestamp:timestamp,oauth_version:'1.0',...extras,...(tokens ? {oauth_token:tokens.token} : {})};
  const pairs = Object.entries({...params,...oauth}).map(([k,v]) => [encode(k),encode(v)]);
  pairs.sort((a,b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
  const normalized=pairs.map(([k,v])=>`${k}=${v}`).join('&');
  const base=[method.toUpperCase(),url,normalized].map(encode).join('&');
  oauth.oauth_signature=createHmac('sha1',`${encode(credentials.secret)}&${encode(tokens?.secret??'')}`).update(base).digest('base64');
  return oauth;
}
export function oauth1Header(...args: Parameters<typeof oauth1Parameters>) {
  return 'OAuth '+Object.entries(oauth1Parameters(...args)).map(([k,v])=>`${encode(k)}="${encode(v)}"`).join(', ');
}
export function diaryCredentials() {
  if (!config.fatsecret.consumerKey || !config.fatsecret.consumerSecret) throw new DiaryAuthError('credentials_required');
  if (!features.fatsecretDiary) throw new DiaryAuthError('disabled');
  return {key:config.fatsecret.consumerKey,secret:config.fatsecret.consumerSecret};
}
export function diaryCallbackUrl() {
  try {
    const url=new URL(config.fatsecret.redirectUri);
    if(url.username || url.password || url.search || url.hash || url.pathname !== '/api/auth/fatsecret/callback' || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)))) throw new Error();
    return url;
  } catch { throw new DiaryAuthError('configuration'); }
}

/** Fixed endpoints only. FatSecret auth expects signed form/query parameters.
 * Permanent account tokens travel in POST bodies for read-only diary methods;
 * only the documented temporary-token exchange uses a GET query.
 */
async function signedFetch(method: 'GET'|'POST', endpoint: string, params: Record<string,string>, tokens?: DiaryTokens, oauth: Record<string,string> = {}) {
  const credentials=diaryCredentials();
  try {
    const signed={...params,...oauth1Parameters(method,endpoint,params,credentials,tokens,oauth)};
    const query=new URLSearchParams(signed).toString();
    const response=await fetch(endpoint+(method==='GET' && query ? `?${query}` : ''),{
      method, headers:{Accept:'application/json',...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded'}:{})},
      ...(method==='POST'?{body:new URLSearchParams(signed)}:{}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),
    });
    if(response.status===401 || response.status===403) throw new DiaryAuthError('authentication');
    if(response.status===429) throw new DiaryAuthError('rate_limited');
    if(!response.ok) throw new DiaryAuthError('unavailable');
    return response;
  } catch(error) { throw error instanceof DiaryAuthError ? error : new DiaryAuthError('unavailable'); }
}
function parseTokens(text: string): DiaryTokens {
  const data=new URLSearchParams(text);
  const token=data.get('oauth_token'),secret=data.get('oauth_token_secret');
  if(!token || !secret || token.length>2048 || secret.length>2048 || /[\r\n]/.test(token+secret) || data.getAll('oauth_token').length!==1 || data.getAll('oauth_token_secret').length!==1) throw new DiaryAuthError('invalid_response');
  return {token,secret};
}
export async function requestDiaryToken(): Promise<DiaryTokens> {
  const response=await signedFetch('POST','https://authentication.fatsecret.com/oauth/request_token',{},undefined,{oauth_callback:diaryCallbackUrl().href});
  const text=await response.text().catch(()=>{throw new DiaryAuthError('invalid_response');});
  if(new URLSearchParams(text).get('oauth_callback_confirmed')!=='true') throw new DiaryAuthError('invalid_response');
  return parseTokens(text);
}
export function diaryAuthorizeUrl(token: string) {
  const url=new URL('https://authentication.fatsecret.com/oauth/authorize');url.searchParams.set('oauth_token',token);return url;
}
export async function exchangeDiaryToken(pending: DiaryTokens, verifier: string): Promise<DiaryTokens> {
  if(!verifier || verifier.length>2048 || /[\r\n]/.test(verifier)) throw new DiaryAuthError('invalid_response');
  const response=await signedFetch('GET','https://authentication.fatsecret.com/oauth/access_token',{},pending,{oauth_verifier:verifier});
  return parseTokens(await response.text().catch(()=>{throw new DiaryAuthError('invalid_response');}));
}

export async function readDiaryResource(resource: 'day'|'month', date: number, tokens: DiaryTokens): Promise<unknown> {
  if(!Number.isSafeInteger(date) || date<0) throw new DiaryAuthError('invalid_response');
  const method=resource==='day'?'food_entries.get.v2':'food_entries.get_month.v2';
  const response=await signedFetch('POST','https://platform.fatsecret.com/rest/server.api',{method,date:String(date),format:'json'},tokens);
  const body:unknown=await response.json().catch(()=>{throw new DiaryAuthError('invalid_response');});
  if(body && typeof body==='object' && 'error' in body) {
    const code=Number((body as {error?:{code?:unknown}}).error?.code);
    throw new DiaryAuthError([5,8,9,13].includes(code)?'authentication':code===12?'rate_limited':'unavailable');
  }
  return body;
}
