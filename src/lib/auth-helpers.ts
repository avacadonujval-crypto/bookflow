import type { Role } from "@prisma/client";

export const ROLE_HOME: Record<Role, string> = {
  PUBLISHER: "/publisher",
  INSTRUCTOR: "/instructor",
  STUDENT: "/student",
  ORG_ADMIN: "/org",
};

/** Default post-login / unauthorized redirect target for a role. */
export function getRoleHome(role: Role): string {
  return ROLE_HOME[role];
}
