import { describe, expect, it } from "vitest";
import { canAccessPath } from "@/lib/rbac";

describe("canAccessPath", () => {
  it("restricts publisher routes to publishers", () => {
    expect(canAccessPath("PUBLISHER", "/publisher/analytics")).toBe(true);
    expect(canAccessPath("STUDENT", "/publisher/books")).toBe(false);
  });

  it("restricts instructor and student areas", () => {
    expect(canAccessPath("INSTRUCTOR", "/instructor/classes")).toBe(true);
    expect(canAccessPath("STUDENT", "/instructor/reports")).toBe(false);
    expect(canAccessPath("STUDENT", "/student/library")).toBe(true);
    expect(canAccessPath("ORG_ADMIN", "/student")).toBe(false);
  });

  it("allows all roles on reader paths", () => {
    for (const role of ["PUBLISHER", "INSTRUCTOR", "STUDENT", "ORG_ADMIN"] as const) {
      expect(canAccessPath(role, "/reader/book-id")).toBe(true);
    }
  });

  it("allows org admin org routes only", () => {
    expect(canAccessPath("ORG_ADMIN", "/org/licenses")).toBe(true);
    expect(canAccessPath("PUBLISHER", "/org/users")).toBe(false);
  });

  it("allows public paths by default", () => {
    expect(canAccessPath("STUDENT", "/login")).toBe(true);
    expect(canAccessPath("STUDENT", "/")).toBe(true);
  });
});
