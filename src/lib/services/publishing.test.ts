import { describe, expect, it } from "vitest";
import { nextPublishedVersion } from "@/lib/services/publishing";

describe("nextPublishedVersion", () => {
  it("keeps version on first publish from draft", () => {
    expect(nextPublishedVersion("DRAFT", 1)).toBe(1);
    expect(nextPublishedVersion("ARCHIVED", 2)).toBe(2);
  });

  it("increments version when re-publishing", () => {
    expect(nextPublishedVersion("PUBLISHED", 1)).toBe(2);
    expect(nextPublishedVersion("PUBLISHED", 3)).toBe(4);
  });
});
