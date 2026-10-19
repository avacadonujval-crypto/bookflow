import Link from "next/link";
import { CalendarDays, Users } from "lucide-react";
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

export default async function InstructorDashboardPage() {
  const user = await requireRole("INSTRUCTOR");

  const classes = await prisma.class.findMany({
    where: { instructorId: user.id },
    include: {
      _count: { select: { enrollments: true, assignments: true } },
      assignments: {
        orderBy: { dueAt: "asc" },
        take: 5,
        include: { book: { select: { title: true } } },
      },
      organization: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const classIds = classes.map((c) => c.id);
  const totalStudents = classes.reduce(
    (sum, cls) => sum + cls._count.enrollments,
    0,
  );
  const totalAssignments = classes.reduce(
    (sum, cls) => sum + cls._count.assignments,
    0,
  );

  const upcomingAssignments = await prisma.assignment.findMany({
    where: {
      classId: { in: classIds },
      OR: [{ dueAt: { gte: new Date() } }, { dueAt: null }],
    },
    include: {
      book: { select: { title: true } },
      class: { select: { name: true } },
    },
    orderBy: { dueAt: "asc" },
    take: 6,
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor classes, assignments, and learner engagement.
          </p>
        </div>
        <Link href="/instructor/classes">
          <Button variant="outline">Manage classes</Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Classes" value={classes.length} />
        <StatCard label="Enrolled learners" value={totalStudents} />
        <StatCard label="Assignments" value={totalAssignments} />
        <StatCard
          label="Upcoming due dates"
          value={upcomingAssignments.filter((a) => a.dueAt).length}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your classes</CardTitle>
            <CardDescription>
              Active classes you are teaching this term
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {classes.length === 0 ? (
              <EmptyState
                title="No classes yet"
                description="Create a class to start assigning books and tracking progress."
                action={
                  <Link href="/instructor/classes">
                    <Button size="sm">View classes</Button>
                  </Link>
                }
              />
            ) : (
              classes.map((cls) => (
                <div
                  key={cls.id}
                  className="rounded-lg border border-neutral-100 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{cls.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {cls.organization.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      {cls._count.enrollments}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {cls._count.assignments} assignment
                    {cls._count.assignments === 1 ? "" : "s"}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming assignments</CardTitle>
            <CardDescription>
              Books assigned to your classes with due dates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingAssignments.length === 0 ? (
              <EmptyState
                title="No upcoming assignments"
                description="Assignments with due dates will appear here."
              />
            ) : (
              upcomingAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="rounded-lg border border-neutral-100 px-3 py-3"
                >
                  <p className="font-medium text-foreground">
                    {assignment.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {assignment.book.title} · {assignment.class.name}
                  </p>
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {assignment.dueAt
                      ? `Due ${formatDate(assignment.dueAt)}`
                      : "No due date"}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
