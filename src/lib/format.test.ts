import { expect, it } from "vitest";
import { footLeft } from "./format";

it("doesn't claim a block is underway when the day is over", () => {
  expect(footLeft([], 21)).toBe("No more meetings today");
});
