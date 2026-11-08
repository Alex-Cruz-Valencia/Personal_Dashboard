import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({files:new Map<string,string>(),config:{fatsecret:{consumerKey:'fake-consumer',consumerSecret:'fake-secret'}},write:vi.fn(),mkdir:vi.fn()}));
vi.mock('server-only',()=>({}));vi.mock('@/lib/config',()=>({config:state.config}));
vi.mock('node:fs/promises',()=>({
  mkdir:state.mkdir,
  writeFile:async(path:string,value:string,options:unknown)=>{state.write(path,value,options);state.files.set(path,value);},
  readFile:async(path:string)=>{if(!state.files.has(path)) throw Object.assign(new Error(),{code:'ENOENT'});return state.files.get(path);},
  rename:async(from:string,to:string)=>{if(!state.files.has(from)) throw Object.assign(new Error(),{code:'ENOENT'});state.files.set(to,state.files.get(from)!);state.files.delete(from);},
  rm:async(path:string)=>{state.files.delete(path);},readdir:async()=>[],stat:async()=>({mtimeMs:Date.now()}),
}));
beforeEach(()=>{vi.resetModules();vi.useFakeTimers();state.files.clear();state.write.mockClear();state.mkdir.mockClear();state.config.fatsecret.consumerSecret='fake-secret';for(const name of ['VERCEL','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN']) vi.stubEnv(name,'');});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();});
describe('encrypted diary token storage',()=>{
  it('encrypts tokens with randomized authenticated encryption and detects tampering or key rotation',async()=>{
    const store=await import('./token-store');const tokens={token:'fake-access',secret:'fake-private-secret'};
    const first=store.encryptDiarySecret(tokens),second=store.encryptDiarySecret(tokens);
    expect(first).not.toBe(second);expect(first).not.toContain(tokens.secret);expect(store.decryptDiarySecret(first)).toEqual(tokens);
    expect(store.decryptDiarySecret(first.slice(0,-3)+'xxx')).toBeNull();
    state.config.fatsecret.consumerSecret='rotated';expect(store.decryptDiarySecret(first)).toBeNull();
  });
  it('writes only encrypted owner-readable files and clears stored access',async()=>{
    const store=await import('./token-store');await store.writeDiaryTokens({token:'access',secret:'private'});
    expect(state.write.mock.calls[0][2]).toMatchObject({mode:0o600});
    expect([...state.files.values()].join('')).not.toContain('private');
    expect(await store.readDiaryTokens()).toEqual({token:'access',secret:'private'});
    await store.clearDiaryTokens();expect(await store.readDiaryTokens()).toBeNull();
  });
  it('consumes pending authorization once atomically and refuses expired requests',async()=>{
    const store=await import('./token-store');const key='a'.repeat(64),tokens={token:'temp',secret:'temporary-private'};
    await store.savePendingDiary(key,tokens);
    const results=await Promise.all([store.consumePendingDiary(key),store.consumePendingDiary(key)]);
    expect(results.filter(Boolean)).toEqual([tokens]);
    await store.savePendingDiary(key,tokens);vi.advanceTimersByTime(600001);expect(await store.consumePendingDiary(key)).toBeNull();
  });
  it('fails closed on serverless deployments without Redis rather than silently losing tokens',async()=>{
    vi.stubEnv('VERCEL','1');const store=await import('./token-store');
    await expect(store.writeDiaryTokens({token:'access',secret:'private'})).rejects.toThrow('Private Redis');
    expect(state.files.size).toBe(0);
  });
});
