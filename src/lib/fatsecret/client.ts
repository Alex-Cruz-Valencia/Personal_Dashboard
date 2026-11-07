import "server-only";
import { config, features } from "@/lib/config";

export type FatSecretErrorCode = "not_configured" | "disabled" | "authentication" | "access_denied" | "rate_limited" | "unavailable" | "invalid_response";
export class FatSecretError extends Error {
  constructor(public readonly code: FatSecretErrorCode) { super(`FatSecret: ${code}`); this.name = "FatSecretError"; }
}
const TOKEN_URL = "https://oauth.fatsecret.com/connect/token";
let token: { value: string; expiresAt: number } | null = null;
let pending: Promise<string> | null = null;
let retryAt = 0;
let lastError: FatSecretErrorCode = "unavailable";

async function requestToken(): Promise<string> {
  try {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.fatsecret.clientId}:${config.fatsecret.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json",
      },
      body: new URLSearchParams({ grant_type: "client_credentials", scope: "basic" }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 400 || response.status === 401) throw new FatSecretError("authentication");
    if (response.status === 403) throw new FatSecretError("access_denied");
    if (response.status === 429) throw new FatSecretError("rate_limited");
    if (!response.ok) throw new FatSecretError("unavailable");
    const data: unknown = await response.json().catch(() => null);
    if (!data || typeof data !== "object") throw new FatSecretError("invalid_response");
    const fields = data as Record<string, unknown>;
    if (typeof fields.access_token !== "string" || !fields.access_token.trim() || fields.access_token.length > 16_384 || typeof fields.token_type !== "string" || fields.token_type.toLowerCase() !== "bearer" || typeof fields.expires_in !== "number" || !Number.isFinite(fields.expires_in) || fields.expires_in <= 60 || fields.expires_in > 7 * 86400) throw new FatSecretError("invalid_response");
    token = { value: fields.access_token, expiresAt: Date.now() + (fields.expires_in - 60) * 1000 };
    return token.value;
  } catch (error) {
    token = null;
    const safe = error instanceof FatSecretError ? error : new FatSecretError("unavailable");
    lastError = safe.code;
    retryAt = Date.now() + 60_000;
    // Never preserve upstream response bodies, request headers, or causes in errors.
    throw safe;
  }
}

/** Server only. Basic food database token, NOT authorization for a user's diary. RAM only. */
export async function getFatSecretAppToken(): Promise<string> {
  if (!config.fatsecret.clientId || !config.fatsecret.clientSecret) throw new FatSecretError("not_configured");
  if (!features.fatsecret) throw new FatSecretError("disabled");
  if (token && token.expiresAt > Date.now()) return token.value;
  if (Date.now() < retryAt) throw new FatSecretError(lastError);
  pending ??= requestToken().finally(() => { pending = null; });
  return pending;
}
