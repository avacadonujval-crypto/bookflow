import { requireRole } from "@/lib/rbac";
import { PublisherShell } from "@/components/layout/role-shells";

export const dynamic = "force-dynamic";

export default async function PublisherLayout({
  children,
}: LayoutProps<"/publisher">) {
  const user = await requireRole("PUBLISHER");

  return <PublisherShell userName={user.name}>{children}</PublisherShell>;
}
