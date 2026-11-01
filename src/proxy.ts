import { NextResponse, type NextRequest } from "next/server";
import { hostAllowed } from "@/lib/allowed-hosts";

const extra = (process.env.ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);

/** Every page and route, reads included: the same trick could otherwise read the dashboard. */
export function proxy(request: NextRequest) {
  if (process.env.VERCEL || hostAllowed(request.headers.get("host"), extra)) return NextResponse.next();
  return new NextResponse("Not allowed.", { status: 403 });
}

export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico).*)" };
