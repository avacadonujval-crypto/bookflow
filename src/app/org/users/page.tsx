import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { InviteUserForm } from "@/components/org/invite-user-form";

export default async function OrgUsersPage() {
  const user = await requireRole("ORG_ADMIN");

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, role: "ORG_ADMIN" },
  });

  if (!membership) {
    return (
      <EmptyState
        title="No organization"
        description="Your account is not linked to an organization."
      />
    );
  }

  const members = await prisma.membership.findMany({
    where: { organizationId: membership.organizationId },
    include: {
      user: { select: { name: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Organization memberships and invitations in BookFlow.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite or add user</CardTitle>
          <CardDescription>
            Create a new account or link an existing user to your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteUserForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-muted-foreground">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-slate-50">
                  <td className="py-3 font-medium text-foreground">
                    {m.user.name}
                  </td>
                  <td className="py-3 text-muted-foreground">{m.user.email}</td>
                  <td className="py-3">
                    <Badge className="bg-neutral-100 text-foreground">
                      {m.role.replace("_", " ").toLowerCase()}
                    </Badge>
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {formatDate(m.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
