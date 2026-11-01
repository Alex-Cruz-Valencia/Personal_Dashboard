import { describe, expect, it } from "vitest";
import { encodeAddresses, htmlToText, replyRecipient } from "./mail-text";

describe("htmlToText", () => {
  it("keeps a link's address", () => {
    expect(htmlToText('<p>See <a href="https://x.co/doc?a=1&amp;b=2">the doc</a>.</p>')).toContain("the doc (https://x.co/doc?a=1&amp;b=2".replace("&amp;", "&"));
  });

  it("doesn't repeat a bare link", () => {
    expect(htmlToText('<a href="https://x.co">https://x.co</a>')).toBe("https://x.co");
  });

  it("decodes entities, named and numeric", () => {
    expect(htmlToText("R&amp;D &lt;now&gt; it&#39;s &#x2014; caf&eacute;")).toBe("R&D <now> it's — caf&eacute;");
  });

  it("keeps paragraphs apart and drops styles", () => {
    expect(htmlToText("<style>p{color:red}</style><p>One</p><p>Two<br>Three</p>")).toBe("One\nTwo\nThree");
  });
});

describe("encodeAddresses", () => {
  it("leaves plain ASCII alone", () => {
    expect(encodeAddresses('"Priya R" <p@x.co>')).toBe('"Priya R" <p@x.co>');
  });

  it("encodes only the name", () => {
    const out = encodeAddresses('"José Núñez" <j@x.co>');
    expect(out).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?= <j@x\.co>$/);
    expect(Buffer.from(out.split("?")[3], "base64").toString()).toBe("José Núñez");
  });

  it("handles several addresses", () => {
    expect(encodeAddresses("José <j@x.co>, Ann <a@x.co>")).toMatch(/^=\?UTF-8.*\?= <j@x\.co>, Ann <a@x\.co>$/);
  });
});

describe("replyRecipient", () => {
  const h = { from: "Ann <a@x.co>", replyTo: "", to: "Me <me@x.co>" };

  it("replies to the sender", () => {
    expect(replyRecipient(h, "me@x.co")).toBe("Ann <a@x.co>");
  });

  it("prefers Reply-To", () => {
    expect(replyRecipient({ ...h, replyTo: "list@x.co" }, "me@x.co")).toBe("list@x.co");
  });

  it("doesn't address you when the message is your own", () => {
    expect(replyRecipient({ from: "Me <ME@x.co>", replyTo: "", to: "Ann <a@x.co>" }, "me@x.co")).toBe("Ann <a@x.co>");
  });
});
