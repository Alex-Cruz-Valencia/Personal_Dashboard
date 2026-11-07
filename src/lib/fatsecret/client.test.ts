import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const settings = vi.hoisted(() => ({ config: { fatsecret: { clientId: 'fake-client', clientSecret: 'fake-secret' } }, features: { fatsecret: true } }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/config', () => settings);
const fetchMock = vi.fn();
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const valid = { access_token: 'fake-private-token', token_type: 'Bearer', expires_in: 86400 };
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-07T20:00:00Z'));
  settings.config.fatsecret.clientId = 'fake-client'; settings.features.fatsecret = true;
  fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('FatSecret application authentication', () => {
  it('sends credentials only in a header to the fixed HTTPS token service with minimum scope', async () => {
    fetchMock.mockResolvedValue(response(valid));
    const { getFatSecretAppToken } = await import('./client');
    expect(await getFatSecretAppToken()).toBe('fake-private-token');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://oauth.fatsecret.com/connect/token');
    expect(options).toMatchObject({method:'POST', cache:'no-store', redirect:'error', signal:expect.any(AbortSignal)});
    expect(options.headers.Authorization).toBe('Basic '+Buffer.from('fake-client:fake-secret').toString('base64'));
    expect(options.body.toString()).toBe('grant_type=client_credentials&scope=basic');
  });
  it('shares parallel token requests and refreshes before expiry', async () => {
    fetchMock.mockImplementation(async () => response(valid));
    const { getFatSecretAppToken } = await import('./client');
    await Promise.all([getFatSecretAppToken(), getFatSecretAppToken()]);
    await getFatSecretAppToken(); expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime((86400 - 60) * 1000);
    await getFatSecretAppToken(); expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('makes no requests when credentials are missing or mock mode is forced', async () => {
    const { getFatSecretAppToken } = await import('./client');
    settings.config.fatsecret.clientId = '';
    await expect(getFatSecretAppToken()).rejects.toMatchObject({code:'not_configured'});
    settings.config.fatsecret.clientId = 'fake-client'; settings.features.fatsecret = false;
    await expect(getFatSecretAppToken()).rejects.toMatchObject({code:'disabled'});
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([[401,'authentication'],[403,'access_denied'],[429,'rate_limited'],[500,'unavailable']] as const)('sanitizes HTTP %s errors and backs off retries', async (status, code) => {
    fetchMock.mockImplementation(async () => response({error:'fake-secret'},status));
    const { getFatSecretAppToken } = await import('./client');
    await expect(getFatSecretAppToken()).rejects.toMatchObject({code,message:`FatSecret: ${code}`});
    await expect(getFatSecretAppToken()).rejects.toMatchObject({code});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60000);
    await expect(getFatSecretAppToken()).rejects.toMatchObject({code});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('rejects malformed token responses and hides network errors', async () => {
    const { getFatSecretAppToken } = await import('./client');
    fetchMock.mockResolvedValueOnce(response({...valid,expires_in:0}));
    await expect(getFatSecretAppToken()).rejects.toMatchObject({code:'invalid_response'});
    vi.advanceTimersByTime(60000); fetchMock.mockRejectedValueOnce(new Error('fake-secret'));
    await expect(getFatSecretAppToken()).rejects.toMatchObject({code:'unavailable',message:'FatSecret: unavailable'});
  });
  it('reports application authentication separately from diary access, without returning secrets', async () => {
    fetchMock.mockResolvedValue(response(valid));
    const { GET } = await import('@/app/api/health/fatsecret/route');
    const result = await GET(new Request('http://localhost:3000/api/health/fatsecret'));
    const data = await result.json();
    expect(data).toMatchObject({appAuthenticated:true,diaryConnected:false,status:'diary_authorization_required'});
    for (const secret of ['fake-private-token','fake-secret','fake-client']) expect(JSON.stringify(data)).not.toContain(secret);
    expect(result.headers.get('cache-control')).toBe('private, no-store');
  });
  it('blocks cross-site probes before contacting FatSecret', async () => {
    const { GET } = await import('@/app/api/health/fatsecret/route');
    const result = await GET(new Request('http://localhost:3000/api/health/fatsecret',{headers:{origin:'https://foreign.example',host:'localhost:3000','sec-fetch-site':'cross-site'}}));
    expect(result.status).toBe(403); expect(fetchMock).not.toHaveBeenCalled();
  });
});
