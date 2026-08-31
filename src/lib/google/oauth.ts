/**
 * Phase 4 — Google OAuth2 (installed-app / web flow) for Calendar + Gmail,
 * both read-only.
 *
 * This is a single-user, local-dev grade flow: tokens live in an httpOnly
 * cookie on the dashboard's own origin (see `tokens.ts`). For a shared or
 * hosted deployment, move token storage to a real datastore.
 */

import "server-only";
import { config } from "@/lib/config";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
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
