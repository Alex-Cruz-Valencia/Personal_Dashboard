import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({config:{fatsecret:{clientId:'fake-client',clientSecret:'fake-secret',consumerKey:'consumer',consumerSecret:'consumer-secret'}},forceMock:false,read:vi.fn(),clear:vi.fn(),resource:vi.fn()}));
vi.mock('server-only',()=>({}));vi.mock('@/lib/config',()=>mocks);
vi.mock('./token-store',()=>({readDiaryTokens:mocks.read,clearDiaryTokens:mocks.clear}));
vi.mock('./oauth1',()=>({readDiaryResource:mocks.resource,DiaryAuthError:class extends Error{constructor(public code:string){super(code);}}}));
const date='2026-11-07';const dateInt=Math.floor(Date.parse(date)/86400000);
const entry={food_entry_id:'1',food_entry_name:'Fixture lunch',food_entry_description:'One serving',meal:'Lunch',date_int:dateInt,calories:'500',protein:'35',carbohydrate:'50',fat:'20'};
beforeEach(()=>{
  vi.resetModules();vi.useFakeTimers();vi.setSystemTime(new Date(date+'T18:00:00Z'));mocks.forceMock=false;mocks.config.fatsecret.consumerKey='consumer';
  mocks.read.mockReset().mockResolvedValue({token:'fake-access',secret:'fake-private'});mocks.clear.mockReset();
  mocks.resource.mockReset().mockImplementation(async(kind:string,date:number)=>kind==='day'?{food_entries:{food_entry:[entry]}}:{month:{day:date===Math.floor(Date.parse('2026-11-01')/86400000)?[{...entry,date_int:dateInt-1}]:[]}});
});
afterEach(()=>vi.useRealTimers());
describe('authorized FatSecret diary adapter',()=>{
  it('shares a bounded twelve-week sync and fetches full details for today',async()=>{
    const {getFatSecretNutrition}=await import('./data');const [a,b]=await Promise.all([getFatSecretNutrition(date),getFatSecretNutrition(date)]);
    expect(a.status).toBe('connected');expect(b.days[date].totals.protein).toBe(35);
    expect(a.days['2026-11-06'].mealsLoaded).toBe(false);expect(a.days[date].mealsLoaded).toBe(true);
    expect(mocks.resource).toHaveBeenCalledTimes(5);
    await getFatSecretNutrition(date);expect(mocks.resource).toHaveBeenCalledTimes(5);
  });
  it('does not turn an empty diary into zero intake or preserve data after disconnect',async()=>{
    mocks.resource.mockImplementation(async(kind:string)=>kind==='day'?{food_entries:null}:{month:{}});
    const {getFatSecretNutrition}=await import('./data');expect(await getFatSecretNutrition(date)).toEqual({status:'connected',days:{}});
    mocks.read.mockResolvedValue(null);expect(await getFatSecretNutrition(date)).toEqual({status:'authorization_required',days:{}});
  });
  it('makes no provider calls without diary credentials or in forced demo mode',async()=>{
    const {getFatSecretNutrition}=await import('./data');mocks.config.fatsecret.consumerKey='';expect((await getFatSecretNutrition(date)).status).toBe('authorization_required');
    mocks.forceMock=true;expect((await getFatSecretNutrition(date)).status).toBe('disabled');expect(mocks.resource).not.toHaveBeenCalled();
  });
  it('clears rejected authorization and backs off transient failures without sample nutrition',async()=>{
    const {getFatSecretNutrition}=await import('./data');const {DiaryAuthError}=await import('./oauth1');
    mocks.resource.mockRejectedValue(new DiaryAuthError('authentication'));expect((await getFatSecretNutrition(date)).status).toBe('authorization_required');expect(mocks.clear).toHaveBeenCalled();
    mocks.resource.mockRejectedValue(new Error('private response'));expect(await getFatSecretNutrition(date)).toEqual({status:'unavailable',days:{}});
    const count=mocks.resource.mock.calls.length;await getFatSecretNutrition(date);expect(mocks.resource).toHaveBeenCalledTimes(count);
  });
});
