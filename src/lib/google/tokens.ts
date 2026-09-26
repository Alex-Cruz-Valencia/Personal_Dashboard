/**
 * Token store for the Google OAuth flow.
 *
 * Single-user dashboard, so this is one JSON blob under a fixed key — no
 * per-user table needed. Two backends, chosen automatically by which env
 * vars are set:
 *
 *  - **Upstash Redis** (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`,
 *    exactly what the Vercel Marketplace Upstash integration injects) —
 *    required on serverless hosts, whose filesystem doesn't persist between
 *    invocations.
 *  - A gitignored local file (`.data/google-tokens.json`), otherwise — fine
 *    for local dev, or any host with a persistent disk.
 *
 * Either way, every browser you point at the dashboard sees live data and it
 * survives a cookie clear, since neither store is scoped to the browser.
 */

import "server-only";
import { Redis } from "@upstash/redis";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { refreshAccessToken, type GoogleTokens } from "./oauth";

const TOKEN_FILE = join(process.cwd(), ".data", "google-tokens.json");
const REDIS_KEY = "dashboard:google-tokens";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
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
  await writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

export async function clearGoogleTokens(): Promise<void> {
  if (kv) {
    await kv.del(REDIS_KEY);
    return;
  }
  await rm(TOKEN_FILE, { force: true });
}

/**
 * A valid access token, refreshing (and persisting) when it's within 60s of
 * expiry. Throws when Google is not connected.
 */
export async function getGoogleAccessToken(): Promise<string> {
  const tokens = await readGoogleTokens();
  if (!tokens) throw new Error("Google not connected");

  if (tokens.expiresAt - Date.now() > 60_000) {
    return tokens.accessToken;
  }
  if (!tokens.refreshToken) {
    throw new Error("Google access token expired and no refresh token is stored");
  }
  const refreshed = await refreshAccessToken(tokens.refreshToken);
  await writeGoogleTokens(refreshed);
  return refreshed.accessToken;
}

export function isGoogleConnected(): Promise<boolean> {
  return readGoogleTokens().then((t) => t != null);
}
