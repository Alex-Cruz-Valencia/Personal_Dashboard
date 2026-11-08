import { describe, expect, it } from "vitest";
import { nowJumped } from "./use-now";

describe("nowJumped", () => {
  it("glides the normal 15-second ticks", () => {
    expect(nowJumped(36_000, 36_015)).toBe(false);
    expect(nowJumped(36_000, 36_300)).toBe(false);
  });
  it("snaps once more than five minutes passed", () => {
    expect(nowJumped(36_000, 36_301)).toBe(true);
    expect(nowJumped(36_000, 50_400)).toBe(true);
  });
  it("snaps across midnight", () => {
    expect(nowJumped(86_385, 0)).toBe(true);
  });
});
