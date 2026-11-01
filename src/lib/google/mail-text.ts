/** Reading and writing email text. Pure, so it can be tested without Gmail. */

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? whole;
    const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
  });
}

/** An HTML email as text, keeping line breaks and each link's address. */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<a\b[^>]*\bhref=["']?(https?:[^"'\s>]+)[^>]*>([\s\S]*?)<\/a>/gi, (_, url: string, label: string) => {
      const shown = label.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return !shown || shown === url ? ` ${url} ` : ` ${shown} (${url}) `;
    })
    .replace(/<\s*br\s*\/?\s*>|<\s*\/\s*(p|div|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text)
    .replace(/[ \t\f\r ]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** RFC 2047 for headers with non-ASCII characters. */
export const mimeHeader = (v: string) =>
  /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=`;

/** One or more addresses for a header: only display names get encoded, never the address itself. */
export function encodeAddresses(v: string): string {
  if (/^[\x20-\x7e]*$/.test(v)) return v;
  return v.replace(/(^|,\s*)"?([^",<]*[^\x20-\x7e][^",<]*?)"?\s*</g, (_, lead: string, name: string) => `${lead}${mimeHeader(name.trim())} <`);
}

/** The address inside '"Name" <a@b.c>', lowercased. */
const addressOf = (v: string) => /[^<>\s,]+@[^<>\s,]+/.exec(v)?.[0].toLowerCase() ?? "";

/**
 * Who a reply goes to. If the message is your own (a thread you labeled last spoke in),
 * replying to its sender would address you, so it continues to whoever you wrote to.
 */
export function replyRecipient(headers: { from: string; replyTo: string; to: string }, me: string): string {
  if (me && addressOf(headers.from) === me.toLowerCase()) return headers.to;
  return headers.replyTo || headers.from;
}
