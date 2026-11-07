import { describe, expect, it } from "vitest";
import { keysForDay, okKeyDay } from "./conflict-ok";

const key = "conflict|2026-11-07|a@9-10|b@9.5-10.5";

describe("okKeyDay", () => {
  it("reads the day from a conflict or tight key", () => {
    expect(okKeyDay(key)).toBe("2026-11-07");
    expect(okKeyDay("tight|2026-11-07|a@9-10|b@10-11")).toBe("2026-11-07");
  });
  it("rejects anything else", () => {
    expect(okKeyDay("conflict||a@9-10|b@9-10")).toBeNull();
    expect(okKeyDay("other|2026-11-07|a@9-10")).toBeNull();
    expect(okKeyDay(42)).toBeNull();
    expect(okKeyDay(`conflict|2026-11-07|${"x".repeat(700)}`)).toBeNull();
    expect(okKeyDay("conflict|2026-11-07|a\nb@9-10")).toBeNull();
  });
});

describe("keysForDay", () => {
  it("keeps only that day's well-formed keys, once each", () => {
    const yesterday = "conflict|2026-11-06|a@9-10|b@9.5-10.5";
    expect(keysForDay([key, key, yesterday, "junk", 3], "2026-11-07")).toEqual([key]);
  });
  it("is empty for a non-list", () => {
    expect(keysForDay(null, "2026-11-07")).toEqual([]);
  });
});
