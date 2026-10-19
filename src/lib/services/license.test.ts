import { describe, expect, it } from "vitest";
import { canAccessBook } from "@/lib/services/license";

describe("canAccessBook", () => {
  it("allows demo books", () => {
    expect(
      canAccessBook({ isDemo: true, isPublisher: false, hasLicense: false }),
    ).toEqual({ allowed: true, reason: "demo" });
  });

  it("allows publisher-owned books", () => {
    expect(
      canAccessBook({ isDemo: false, isPublisher: true, hasLicense: false }),
    ).toEqual({ allowed: true, reason: "publisher" });
  });

  it("allows licensed access", () => {
    expect(
      canAccessBook({ isDemo: false, isPublisher: false, hasLicense: true }),
    ).toEqual({ allowed: true, reason: "license" });
  });

  it("denies when no license or ownership", () => {
    expect(
      canAccessBook({ isDemo: false, isPublisher: false, hasLicense: false }),
    ).toEqual({ allowed: false, reason: "no_license" });
  });
});
