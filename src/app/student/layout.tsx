import { requireRole } from "@/lib/rbac";
import { StudentShell } from "@/components/layout/role-shells";

export const dynamic = "force-dynamic";

export default async function StudentLayout({
  children,
}: LayoutProps<"/student">) {
  const user = await requireRole("STUDENT");

  return <StudentShell userName={user.name}>{children}</StudentShell>;
}
