import { describe, expect, it } from "vitest";
import { cleanStored, KEEP_MS, missingKeys, parseNudge, replyKey, waitingKey, type StoredTriage } from "./triage-keys";

const NOW = 1_800_000_000_000;

describe("stored triage", () => {
  it("keeps a well-formed reply suggestion", () => {
    const raw = { kind: "reply", at: NOW - 1000, suggestion: { id: "m1", action: "file", label: "Receipts", reason: "A receipt." } };
    expect(cleanStored(raw, NOW)).toEqual(raw);
  });

  it("keeps \"nothing to suggest\", so the email isn't asked about again", () => {
    expect(cleanStored({ kind: "reply", at: NOW, suggestion: null }, NOW)).toEqual({ kind: "reply", at: NOW, suggestion: null });
  });

  it("drops entries past the keep time, from the future, or malformed", () => {
    expect(cleanStored({ kind: "reply", at: NOW - KEEP_MS - 1, suggestion: null }, NOW)).toBeNull();
    expect(cleanStored({ kind: "reply", at: NOW + 3_600_000, suggestion: null }, NOW)).toBeNull();
    expect(cleanStored({ kind: "reply", at: NOW, suggestion: { id: "m1", action: "send" } }, NOW)).toBeNull();
    expect(cleanStored({ kind: "waiting", at: NOW, nudge: { action: "chase" } }, NOW)).toBeNull();
    expect(cleanStored("nope", NOW)).toBeNull();
  });

  it("keeps a follow-up draft only on a nudge", () => {
    expect(cleanStored({ kind: "waiting", at: NOW, nudge: { action: "let_go", reason: "Old.", draft: "Hi" } }, NOW)).toEqual({
      kind: "waiting",
      at: NOW,
      nudge: { action: "let_go", reason: "Old." },
    });
  });

  it("lists only what nothing is stored for, once each", () => {
    const stored = new Map<string, StoredTriage>([[replyKey("a"), { kind: "reply", at: NOW, suggestion: null }]]);
    expect(missingKeys([replyKey("a"), replyKey("b"), replyKey("b"), waitingKey("c")], stored)).toEqual(["r:b", "w:c"]);
  });
});

describe("parseNudge", () => {
  it("reads a nudge with its draft", () => {
    const text = 'Sure: {"action": "nudge", "reason": "They owe a date.", "draft": "Hi Sam,\\n\\n\\n\\nAny update?\\n\\nAlex"}';
    expect(parseNudge(text)).toEqual({ action: "nudge", reason: "They owe a date.", draft: "Hi Sam,\n\nAny update?\n\nAlex" });
  });

  it("drops the draft when it says let it go", () => {
    expect(parseNudge('{"action": "let_go", "reason": "The event passed.", "draft": "x"}')).toEqual({
      action: "let_go",
      reason: "The event passed.",
    });
  });

  it("refuses unknown actions and non-JSON", () => {
    expect(parseNudge('{"action": "send", "reason": "x"}')).toBeNull();
    expect(parseNudge("I would follow up.")).toBeNull();
  });

  it("caps the reason and the draft", () => {
    const n = parseNudge(JSON.stringify({ action: "nudge", reason: "r".repeat(300), draft: "d".repeat(5000) }));
    expect(n?.reason).toHaveLength(140);
    expect(n?.draft).toHaveLength(1500);
  });
});
