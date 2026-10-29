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
// Also matches the media-upload form (`/upload/gmail/v1/.../messages/send`).
const GMAIL_SEND = /^(\/upload)?\/gmail\/v1\/users\/[^/]+\/(messages|drafts)\/send\/?$/i;
// A batch request wraps other calls (a send among them) in its body, where the
// path check above can't see it. Nothing here batches, so refuse it outright.
const GOOGLE_BATCH = /^\/batch(\/|$)/i;

export function isGmailSend(input: string | URL): boolean {
  let url: URL;
  try {
    url = new URL(String(input));
  } catch {
    return false;
  }
  if (!url.hostname.endsWith("googleapis.com")) return false;
  let path = url.pathname;
  try {
    path = decodeURIComponent(path); // "messages%2Fsend" is still a send
  } catch {
    return true; // a path that won't decode is not one this app builds
  }
  return GMAIL_SEND.test(path) || GOOGLE_BATCH.test(path);
}

export function assertNoSend(input: string | URL): void {
  if (isGmailSend(input)) {
    throw new Error("Sending email is disabled in this app. Save a draft and send it from Gmail.");
  }
}
