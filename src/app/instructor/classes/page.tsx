import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { CreateClassForm } from "@/components/instructor/create-class-form";

export default async function InstructorClassesPage() {
  const user = await requireRole("INSTRUCTOR");

  const classes = await prisma.class.findMany({
    where: { instructorId: user.id },
    include: {
      _count: { select: { enrollments: true, assignments: true } },
      organization: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Classes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create cohorts, enroll learners, and assign BookFlow titles.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Your classes</CardTitle>
            <CardDescription>
              Select a class to view progress and manage assignments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {classes.length === 0 ? (
              <EmptyState
                title="No classes yet"
                description="Create your first class using the form on the right."
              />
            ) : (
              classes.map((cls) => (
                <div
                  key={cls.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-100 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-foreground">{cls.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {cls.organization.name} · {cls._count.enrollments} students ·{" "}
                      {cls._count.assignments} assignments
                    </p>
                  </div>
                  <Link href={`/instructor/classes/${cls.id}`}>
                    <Button size="sm" variant="outline">
                      Open
                    </Button>
                  </Link>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <CreateClassForm />
      </div>
    </div>
  );
}
