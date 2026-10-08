/**
 * Phase 4 — Google OAuth2 (installed-app / web flow) for Calendar
 * (read/write on events) + Gmail (read/modify — trash and label moves need
 * write access; see `gmail.ts`).
 *
 * This is a single-user flow: tokens are stored server-side by `tokens.ts` —
 * in Redis (Upstash/KV) when configured, otherwise a gitignored local file.
 * A serverless host needs the Redis backend.
 */

import "server-only";
import { config } from "@/lib/config";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  // Narrower than the full `calendar` scope (which also covers creating,
  // deleting and sharing whole *calendars*) — this is read/write on
  // *events* only, which is all editing/rescheduling/deleting one needs.
  // Kept alongside calendar.readonly rather than assumed to be a superset
  // of it, since calendarList discovery (calendar.ts's auto-discovery) is
  // calendar-level metadata, not an event.
  "https://www.googleapis.com/auth/calendar.events",
  // Superset of gmail.readonly: read + labels/trash, but never a permanent,
  // bypass-the-trash delete (that needs the much broader mail.google.com
  // scope) — enough for "get rid of it from the inbox view."
  "https://www.googleapis.com/auth/gmail.modify",
  "openid",
  "email",
  "profile",
];

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
  scope?: string;
}

export function getAuthUrl(state: string): string {
  if (!config.google.clientId) throw new Error("Google client id not configured");
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", config.google.clientId);
  url.searchParams.set("redirect_uri", config.google.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

/**
 * The stored Google connection can't be used and only a fresh consent fixes
 * it: never connected, no refresh token, or Google rejected the refresh token
 * (`invalid_grant` — revoked, or expired after 7 days while the OAuth consent
 * screen is in "Testing"). The dashboard turns this into a "Reconnect" link
 * rather than silently showing sample data.
 */
export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || data.error) {
    if (data.error === "invalid_grant") {
      throw new GoogleAuthError(
        `Google refresh token rejected: ${data.error_description ?? "invalid_grant"}`,
      );
    }
    throw new Error(
      `Google token endpoint: ${data.error ?? res.status} ${data.error_description ?? ""}`.trim(),
    );
  }
  return data;
}

export async function exchangeCode(code: string): Promise<GoogleTokens> {
  const data = await postToken({
    code,
    client_id: config.google.clientId ?? "",
    client_secret: config.google.clientSecret ?? "",
    redirect_uri: config.google.redirectUri,
    grant_type: "authorization_code",
  });
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  };
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<GoogleTokens> {
  const data = await postToken({
    refresh_token: refreshToken,
    client_id: config.google.clientId ?? "",
    client_secret: config.google.clientSecret ?? "",
    grant_type: "refresh_token",
  });
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  };
}
