import { describe, expect, it } from "vitest";
import { ROLE_HOME, getRoleHome } from "@/lib/auth-helpers";

describe("ROLE_HOME", () => {
  it("maps each role to its dashboard path", () => {
    expect(ROLE_HOME.PUBLISHER).toBe("/publisher");
    expect(ROLE_HOME.INSTRUCTOR).toBe("/instructor");
    expect(ROLE_HOME.STUDENT).toBe("/student");
    expect(ROLE_HOME.ORG_ADMIN).toBe("/org");
  });
});

describe("getRoleHome", () => {
  it("returns the same path as ROLE_HOME", () => {
    expect(getRoleHome("STUDENT")).toBe("/student");
    expect(getRoleHome("PUBLISHER")).toBe("/publisher");
  });
});
