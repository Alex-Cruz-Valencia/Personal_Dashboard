import { describe, expect, it } from "vitest";
import { referenceLabel } from "./quick-file";

describe("referenceLabel", () => {
  it("finds the label regardless of case and spacing", () => {
    expect(referenceLabel([{ name: "Work" }, { name: " Reference  Files " }])?.name).toBe(" Reference  Files ");
  });
  it("prefers 'Reference files' over plain 'Reference'", () => {
    expect(referenceLabel([{ name: "Reference" }, { name: "Reference files" }])?.name).toBe("Reference files");
  });
  it("is null when there's no such label or labels haven't loaded", () => {
    expect(referenceLabel([{ name: "References/old" }])).toBeNull();
    expect(referenceLabel(null)).toBeNull();
  });
});
