import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/google/oauth";
import { writeGoogleTokens } from "@/lib/google/tokens";
import { STATE_COOKIE } from "../route";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const home = new URL("/", url.origin);

  if (error) {
    home.searchParams.set("google", `error:${error}`);
    return NextResponse.redirect(home);
  }

  const jar = await cookies();
  const expectedState = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    home.searchParams.set("google", "error:state_mismatch");
    return NextResponse.redirect(home);
  }

  try {
    const tokens = await exchangeCode(code);
    await writeGoogleTokens(tokens);
    home.searchParams.set("google", "connected");
  } catch (err) {
    home.searchParams.set("google", `error:${encodeURIComponent((err as Error).message)}`);
  }

  return NextResponse.redirect(home);
}
