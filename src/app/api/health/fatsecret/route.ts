import { NextResponse } from "next/server";
import { config, features } from "@/lib/config";
import { FatSecretError, getFatSecretAppToken } from "@/lib/fatsecret/client";
import { readDiaryTokens } from "@/lib/fatsecret/token-store";
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
    const diaryConnected = features.fatsecretDiary ? Boolean(await readDiaryTokens().catch(() => null)) : false;
    return NextResponse.json({ configured, appAuthenticated: true, diaryConnected, status: diaryConnected ? "authorized" : "diary_authorization_required", message: diaryConnected ? "Application authentication and saved diary authorization are available. Health reads the diary separately." : "Application credentials work. Open /health/connect/fatsecret to authorize your food diary." }, { headers });
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
