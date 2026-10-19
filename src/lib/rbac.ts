import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_HOME } from "@/lib/auth-helpers";

export { ROLE_HOME };

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Returns the authenticated user with a live database id.
 * After `db:seed`, JWT cookies can still hold a deleted user id — resolve by email.
 */
export async function requireUser(): Promise<AppUser> {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.email) redirect("/login");

  const email = sessionUser.email.toLowerCase();
  const byEmail = await prisma.user.findUnique({ where: { email } });
  const user =
    byEmail ??
    (await prisma.user.findUnique({ where: { id: sessionUser.id } }));

  if (!user) {
    redirect("/login?error=session_expired");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function requireRole(...roles: Role[]): Promise<AppUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    redirect(ROLE_HOME[user.role]);
  }
  return user;
}

export function canAccessPath(role: Role, pathname: string) {
  if (pathname.startsWith("/publisher")) return role === "PUBLISHER";
  if (pathname.startsWith("/instructor")) return role === "INSTRUCTOR";
  if (pathname.startsWith("/student")) return role === "STUDENT";
  if (pathname.startsWith("/org")) return role === "ORG_ADMIN";
  if (pathname.startsWith("/reader")) {
    return ["PUBLISHER", "INSTRUCTOR", "STUDENT", "ORG_ADMIN"].includes(role);
  }
  return true;
}
