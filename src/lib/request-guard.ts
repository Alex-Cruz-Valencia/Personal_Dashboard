import "server-only";
import { NextResponse } from "next/server";

/**
 * Write routes only answer the dashboard's own pages. Without this, any other
 * website open in the same browser could post a form (or a `fetch` with
 * `no-cors`) at a running dashboard — `localhost:3000` has no login in front of
 * it — and create tasks or events, or trash mail. Same rule `guardAi` applies.
 *
 * `Origin` is sent on every cross-origin request and on same-origin non-GET
 * requests; when it's missing, `Sec-Fetch-Site` says where the request came
 * from ("none" = typed into the address bar). Returns a 403 response to send
 * back, or null when the request may proceed.
 */
export function rejectCrossSite(
  request: Request,
  { allowDirect = false }: { allowDirect?: boolean } = {},
): NextResponse | null {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host; // "null" (sandboxed frame) doesn't parse
    } catch {
      /* treated as foreign */
    }
    if (host && originHost === host) return null;
  } else {
    const site = request.headers.get("sec-fetch-site");
    if (site === "same-origin" || (allowDirect && site === "none")) return null;
    // A client that sends neither header (curl, a script) isn't a browser
    // being tricked by another page — the deployment's own protection gates it.
    if (!site) return null;
  }
  return NextResponse.json({ error: "Not allowed." }, { status: 403 });
}

/** Todoist task ids are short alphanumerics; anything else never reaches a URL. */
export const validTaskId = (id: string) => /^[A-Za-z0-9_-]{1,64}$/.test(id);

export const badId = () => NextResponse.json({ error: "Bad id." }, { status: 400 });
