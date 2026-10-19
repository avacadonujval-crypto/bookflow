import { requireRole } from "@/lib/rbac";
import { InstructorShell } from "@/components/layout/role-shells";

export const dynamic = "force-dynamic";

export default async function InstructorLayout({
  children,
}: LayoutProps<"/instructor">) {
  const user = await requireRole("INSTRUCTOR");

  return <InstructorShell userName={user.name}>{children}</InstructorShell>;
}
