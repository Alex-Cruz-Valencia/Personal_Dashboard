/**
 * Token store for the Google OAuth flow.
 *
 * Single-user dashboard, so this is one JSON blob under a fixed key — no
 * per-user table needed. Two backends, chosen automatically by which env
 * vars are set:
 *
 *  - **Upstash Redis**, required on serverless hosts (whose filesystem
 *    doesn't persist between invocations). Reads either var-name pair:
 *    `UPSTASH_REDIS_REST_URL`/`_TOKEN` (Upstash's own naming, e.g. a raw
 *    Upstash account) or `KV_REST_API_URL`/`KV_REST_API_TOKEN` (what the
 *    Vercel Marketplace "Upstash for Redis" integration actually injects —
 *    kept for compatibility with the old first-party Vercel KV).
 *  - A gitignored local file (`.data/google-tokens.json`), otherwise — fine
 *    for local dev, or any host with a persistent disk.
 *
 * Either way, every browser you point at the dashboard sees live data and it
 * survives a cookie clear, since neither store is scoped to the browser.
 */

import "server-only";
import { Redis } from "@upstash/redis";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { assertNoSend } from "./no-send";
import { GoogleAuthError, refreshAccessToken, type GoogleTokens } from "./oauth";
import { retryOnDroppedConnection } from "./retry";

const TOKEN_FILE = join(process.cwd(), ".data", "google-tokens.json");
const REDIS_KEY = "dashboard:google-tokens";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const kv = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

// No in-memory cache: Next dev/runtime spreads requests across worker
// processes (and serverless spreads them across instances entirely), and a
// stale "not connected" read must never stick. Both backends are cheap
// enough to hit on every call.
export async function readGoogleTokens(): Promise<GoogleTokens | null> {
  if (kv) return (await kv.get<GoogleTokens>(REDIS_KEY)) ?? null;
  try {
    const raw = await readFile(TOKEN_FILE, "utf8");
    return JSON.parse(raw) as GoogleTokens;
  } catch {
    return null;
  }
}

export async function writeGoogleTokens(tokens: GoogleTokens): Promise<void> {
  if (kv) {
    await kv.set(REDIS_KEY, tokens);
    return;
  }
  await mkdir(dirname(TOKEN_FILE), { recursive: true });
  // Renamed into place, so a reader never catches a half-written file.
  const temp = `${TOKEN_FILE}.${process.pid}.${Date.now()}`;
  await writeFile(temp, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  await rename(temp, TOKEN_FILE);
}

export async function clearGoogleTokens(): Promise<void> {
  if (kv) {
    await kv.del(REDIS_KEY);
    return;
  }
  await rm(TOKEN_FILE, { force: true });
}

let refreshing: Promise<GoogleTokens> | null = null;

/** A page render starts dozens of calls at once; they should share one refresh, not race. */
function refreshOnce(refreshToken: string): Promise<GoogleTokens> {
  refreshing ??= refreshAccessToken(refreshToken)
    .then(async (fresh) => {
      await writeGoogleTokens(fresh);
      return fresh;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/**
 * A valid access token, refreshing (and persisting) when it's within 60s of
 * expiry. Throws when Google is not connected.
 */
export async function getGoogleAccessToken(): Promise<string> {
  const tokens = await readGoogleTokens();
  if (!tokens) throw new GoogleAuthError("Google not connected");

  if (tokens.expiresAt - Date.now() > 60_000) {
    return tokens.accessToken;
  }
  if (!tokens.refreshToken) {
    throw new GoogleAuthError("Google access token expired and no refresh token is stored");
  }
  return (await refreshOnce(tokens.refreshToken)).accessToken;
}

/**
 * `fetch` for Google APIs: attaches the access token and, if Google rejects
 * it (401), refreshes once, persists the new token and retries. The stored
 * expiry isn't proof a token still works — Google can invalidate an access
 * token early, and without this the dashboard kept sending a dead token
 * (sample mail, no calendar) until its recorded expiry passed.
 */
/** A Google call that hangs would hold the whole page render; give up instead. */
const GOOGLE_TIMEOUT_MS = 15_000;

export async function googleFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  assertNoSend(input); // mail is only ever drafted here, never sent
  const send = (token: string) =>
    retryOnDroppedConnection(
      () =>
        fetch(input, {
          ...init,
          signal: init.signal ?? AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
          headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
        }),
      init,
    );

  const res = await send(await getGoogleAccessToken());
  if (res.status !== 401) return res;

  const tokens = await readGoogleTokens();
  if (!tokens?.refreshToken) return res;
  return send((await refreshOnce(tokens.refreshToken)).accessToken);
}

export function isGoogleConnected(): Promise<boolean> {
  return readGoogleTokens().then((t) => t != null);
}
