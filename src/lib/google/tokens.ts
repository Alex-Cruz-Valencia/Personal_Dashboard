/**
 * httpOnly-cookie token store for the Google OAuth flow.
 *
 * Single-user / local-dev grade. The cookie is optionally HMAC-signed with
 * `DASHBOARD_SESSION_SECRET` so a tampered value is rejected.
 */

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { config } from "@/lib/config";
import { refreshAccessToken, type GoogleTokens } from "./oauth";

const COOKIE = "gdash_google";
const MAX_AGE = 60 * 60 * 24 * 180; // 180 days

function b64urlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}
function b64urlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(payload: string): string {
  if (!config.sessionSecret) return payload;
  const mac = createHmac("sha256", config.sessionSecret).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

function verify(raw: string): string | null {
  if (!config.sessionSecret) return raw;
  const idx = raw.lastIndexOf(".");
  if (idx === -1) return null;
  const payload = raw.slice(0, idx);
  const mac = raw.slice(idx + 1);
  const expected = createHmac("sha256", config.sessionSecret)
    .update(payload)
    .digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return payload;
}

export async function readGoogleTokens(): Promise<GoogleTokens | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const payload = verify(raw);
  if (!payload) return null;
  try {
    return JSON.parse(b64urlDecode(payload)) as GoogleTokens;
  } catch {
    return null;
  }
}

export async function writeGoogleTokens(tokens: GoogleTokens): Promise<void> {
  const value = sign(b64urlEncode(JSON.stringify(tokens)));
  try {
    (await cookies()).set(COOKIE, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE,
    });
  } catch {
    // Called from a read-only render context — the caller still gets to use
    // the in-memory tokens for this request; they'll be re-derived next time.
  }
}

export async function clearGoogleTokens(): Promise<void> {
  try {
    (await cookies()).delete(COOKIE);
  } catch {
    /* read-only context */
  }
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
