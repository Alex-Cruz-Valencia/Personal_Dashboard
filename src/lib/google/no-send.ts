/**
 * This app never sends email. It can read mail, move or trash it, and save a
 * DRAFT; sending is always the person's own click in Gmail.
 *
 * Google's `gmail.modify` scope technically allows sending, so the scope alone
 * can't enforce that. This is the code-level guarantee: every Google call goes
 * through `googleFetch`, which calls this first, so even a future bug can't
 * reach Gmail's send endpoints. `scripts/check-no-send.mjs` (run before every
 * build) also fails if code that could send is ever added.
 */
const GMAIL_SEND = /^\/gmail\/v1\/users\/[^/]+\/(messages|drafts)\/send\/?$/i;

export function isGmailSend(input: string | URL): boolean {
  try {
    const url = new URL(String(input));
    return url.hostname.endsWith("googleapis.com") && GMAIL_SEND.test(url.pathname);
  } catch {
    return false;
  }
}

export function assertNoSend(input: string | URL): void {
  if (isGmailSend(input)) {
    throw new Error("Sending email is disabled in this app. Save a draft and send it from Gmail.");
  }
}
