import { describe, expect, it } from "vitest";
import { sameClockOnDay } from "./time";

describe("sameClockOnDay", () => {
  it("keeps the clock time across the fall change", () => {
    // 1pm EDT on Oct 31; New York's clocks went back on Nov 1, 2026.
    expect(sameClockOnDay("2026-10-31T17:00:00Z", "2026-11-02", "America/New_York")).toBe("2026-11-02T18:00:00Z");
  });

  it("keeps the clock time across the spring change", () => {
    expect(sameClockOnDay("2026-03-07T18:00:00Z", "2026-03-09", "America/New_York")).toBe("2026-03-09T17:00:00Z");
  });

  it("is a plain day move otherwise", () => {
    expect(sameClockOnDay("2026-06-01T17:00:00Z", "2026-06-03", "America/New_York")).toBe("2026-06-03T17:00:00Z");
  });
});
