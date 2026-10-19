import Link from "next/link";
import { Building2, Users } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { StatCard } from "@/components/layout/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function OrgDashboardPage() {
  const user = await requireRole("ORG_ADMIN");

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, role: "ORG_ADMIN" },
    include: { organization: true },
  });

  if (!membership) {
    return (
      <EmptyState
        title="No organization linked"
        description="Your account is not associated with an organization yet."
        action={
          <Link href="/register">
            <Button size="sm" variant="outline">
              Contact support
            </Button>
          </Link>
        }
      />
    );
  }

  const orgId = membership.organizationId;

  const [
    memberCount,
    activeLicenses,
    classCount,
    bookCount,
    recentMembers,
    licenseSummary,
  ] = await Promise.all([
    prisma.membership.count({ where: { organizationId: orgId } }),
    prisma.license.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.class.count({ where: { organizationId: orgId } }),
    prisma.book.count({ where: { organizationId: orgId } }),
    prisma.membership.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.license.findMany({
      where: { organizationId: orgId, isActive: true },
      include: { book: { select: { title: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  const seatsUsed = licenseSummary.reduce((sum, l) => sum + l.seatsUsed, 0);
  const seatsTotal = licenseSummary.reduce((sum, l) => sum + l.seats, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-foreground">
            <Building2 className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">
              Organization
            </span>
          </div>
          <h1 className="mt-2 page-title">
            {membership.organization.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of users, licenses, and learning activity.
          </p>
        </div>
        <Link href="/org/users">
          <Button variant="outline">Manage users</Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Members" value={memberCount} />
        <StatCard label="Active licenses" value={activeLicenses} />
        <StatCard label="Classes" value={classCount} />
        <StatCard label="Licensed books" value={bookCount} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>License utilization</CardTitle>
            <CardDescription>
              Seat usage across active organization licenses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-neutral-50 px-4 py-3">
              <p className="text-sm text-muted-foreground">Seats used</p>
              <p className="stat-value">
                {seatsUsed} / {seatsTotal || "—"}
              </p>
            </div>
            {licenseSummary.length === 0 ? (
              <EmptyState
                title="No active licenses"
                description="Assign book licenses to classes or users from the licenses page."
                action={
                  <Link href="/org/licenses">
                    <Button size="sm">View licenses</Button>
                  </Link>
                }
              />
            ) : (
              licenseSummary.map((license) => (
                <div
                  key={license.id}
                  className="rounded-lg border border-neutral-100 px-3 py-3"
                >
                  <p className="font-medium text-foreground">
                    {license.book.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {license.seatsUsed} / {license.seats} seats used
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Updated {formatDate(license.updatedAt)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent members</CardTitle>
            <CardDescription>
              Latest people added to your organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentMembers.length === 0 ? (
              <EmptyState
                title="No members yet"
                description="Invite users or connect accounts to your organization."
              />
            ) : (
              recentMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="truncate font-medium text-foreground">
                        {member.user.name}
                      </p>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.user.email}
                    </p>
                  </div>
                  <Badge className="bg-neutral-100 text-foreground">
                    {member.user.role.replace("_", " ").toLowerCase()}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
