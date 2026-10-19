import { requireRole } from "@/lib/rbac";
import { OrgShell } from "@/components/layout/role-shells";

export const dynamic = "force-dynamic";

export default async function OrgLayout({ children }: LayoutProps<"/org">) {
  const user = await requireRole("ORG_ADMIN");

  return <OrgShell userName={user.name}>{children}</OrgShell>;
}
