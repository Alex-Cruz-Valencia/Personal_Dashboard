import { NextResponse } from "next/server";
import { config, features } from "@/lib/config";
import { FatSecretError, getFatSecretAppToken } from "@/lib/fatsecret/client";
import { rejectCrossSite } from "@/lib/request-guard";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

/** Check application authentication only. Never return credentials, tokens, or diary records. */
export async function GET(request: Request) {
  const blocked = rejectCrossSite(request, { allowDirect: true });
  if (blocked) return blocked;
  const configured = Boolean(config.fatsecret.clientId && config.fatsecret.clientSecret);
  if (!configured) return NextResponse.json({ configured, appAuthenticated: false, diaryConnected: false, status: "not_configured" }, { headers });
  if (!features.fatsecret) return NextResponse.json({ configured, appAuthenticated: false, diaryConnected: false, status: "disabled" }, { headers });
  try {
    await getFatSecretAppToken();
    return NextResponse.json({ configured, appAuthenticated: true, diaryConnected: false, status: "diary_authorization_required", message: "Application credentials work. Connecting an existing FatSecret diary requires separate OAuth 1.0 credentials and account authorization." }, { headers });
  } catch (error) {
    const code = error instanceof FatSecretError ? error.code : "unavailable";
    const messages: Record<string, string> = {
      authentication: "FatSecret rejected the application credentials. Check the server environment settings.",
      access_denied: "FatSecret denied access. Check your application’s API access and IP restrictions.",
      rate_limited: "FatSecret is limiting requests. Please try later.",
    };
    return NextResponse.json({ configured, appAuthenticated: false, diaryConnected: false, status: code, message: messages[code] ?? "FatSecret is temporarily unavailable. Please try later." }, { status: code === "rate_limited" ? 429 : 502, headers });
  }
}
