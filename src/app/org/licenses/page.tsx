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
import { Progress } from "@/components/ui/progress";
import { LicenseUpdateForm } from "@/components/org/license-update-form";

export default async function OrgLicensesPage() {
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

  const licenses = await prisma.license.findMany({
    where: { organizationId: membership.organizationId },
    include: { book: { select: { title: true, author: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Licenses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seat usage and status for organization-scoped BookFlow licenses.
        </p>
      </div>

      {licenses.length === 0 ? (
        <EmptyState
          title="No licenses"
          description="Organization licenses will appear here when books are provisioned."
        />
      ) : (
        <div className="space-y-4">
          {licenses.map((license) => {
            const utilization =
              license.seats > 0
                ? Math.min(100, (license.seatsUsed / license.seats) * 100)
                : 0;
            return (
              <Card key={license.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {license.book.title}
                      </CardTitle>
                      <CardDescription>{license.book.author}</CardDescription>
                    </div>
                    <Badge
                      className={
                        license.isActive
                          ? "bg-neutral-100 text-foreground"
                          : "bg-neutral-100 text-muted-foreground"
                      }
                    >
                      {license.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>
                        Seats {license.seatsUsed} / {license.seats}
                      </span>
                      <span>{license.scope.toLowerCase()}</span>
                    </div>
                    <Progress value={utilization} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Valid from {formatDate(license.startsAt)}
                    {license.endsAt ? ` · ends ${formatDate(license.endsAt)}` : ""}
                    · Updated {formatDate(license.updatedAt)}
                  </p>
                  {license.scope === "ORGANIZATION" ? (
                    <LicenseUpdateForm
                      licenseId={license.id}
                      seats={license.seats}
                      isActive={license.isActive}
                    />
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
