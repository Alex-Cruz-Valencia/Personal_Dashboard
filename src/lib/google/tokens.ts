/**
 * Token store for the Google OAuth flow.
 *
 * This is a single-user, localhost dashboard, so tokens are cached in a
 * gitignored file on the server (`.data/google-tokens.json`) — like `gcloud`
 * stashing credentials under `~/.config`. Every browser you point at the
 * dashboard then sees live data, and it survives a cookie clear.
 *
 * For a shared or hosted deployment, swap this for a real per-user datastore.
 */

import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { refreshAccessToken, type GoogleTokens } from "./oauth";

const TOKEN_FILE = join(process.cwd(), ".data", "google-tokens.json");

// No in-memory cache: Next dev/runtime spreads requests across worker
// processes, and a stale "not connected" read must never stick. The file
// read is cheap and this is a single-user localhost app.
export async function readGoogleTokens(): Promise<GoogleTokens | null> {
  try {
    const raw = await readFile(TOKEN_FILE, "utf8");
    return JSON.parse(raw) as GoogleTokens;
  } catch {
    return null;
  }
}

export async function writeGoogleTokens(tokens: GoogleTokens): Promise<void> {
  await mkdir(dirname(TOKEN_FILE), { recursive: true });
  await writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

export async function clearGoogleTokens(): Promise<void> {
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
