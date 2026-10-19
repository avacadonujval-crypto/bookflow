import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { formatDate, formatPercent } from "@/lib/utils";
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
import { Progress } from "@/components/ui/progress";

export default async function StudentAssignmentsPage() {
  const user = await requireRole("STUDENT");

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    include: {
      class: {
        include: {
          assignments: {
            include: {
              book: { select: { id: true, title: true } },
            },
            orderBy: { dueAt: "asc" },
          },
        },
      },
    },
  });

  const assignments = enrollments.flatMap((e) =>
    e.class.assignments.map((a) => ({
      ...a,
      className: e.class.name,
    })),
  );

  const bookIds = [...new Set(assignments.map((a) => a.bookId))];
  const progressRows = await prisma.readingProgress.findMany({
    where: { userId: user.id, bookId: { in: bookIds } },
  });
  const progressByBook = new Map(progressRows.map((p) => [p.bookId, p]));

  const now = new Date();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Assignments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Books your instructors assigned with due dates and reading progress.
        </p>
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          description="When you are enrolled in a class with assigned books, they will show up here."
        />
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => {
            const progress = progressByBook.get(assignment.bookId);
            const overdue = assignment.dueAt && assignment.dueAt < now;
            const dueSoon =
              assignment.dueAt &&
              !overdue &&
              assignment.dueAt.getTime() - now.getTime() < 3 * 86400000;

            return (
              <Card key={assignment.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{assignment.title}</CardTitle>
                      <CardDescription>
                        {assignment.book.title} · {assignment.className}
                      </CardDescription>
                    </div>
                    {overdue ? (
                      <Badge className="bg-neutral-100 text-foreground">Overdue</Badge>
                    ) : dueSoon ? (
                      <Badge className="bg-neutral-100 text-muted-foreground">Due soon</Badge>
                    ) : (
                      <Badge className="bg-neutral-100 text-foreground">Active</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {assignment.description ? (
                    <p className="text-sm text-muted-foreground">{assignment.description}</p>
                  ) : null}
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    {assignment.dueAt
                      ? `Due ${formatDate(assignment.dueAt)}`
                      : "No due date"}
                  </div>
                  {progress ? (
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>Reading progress</span>
                        <span>{formatPercent(progress.percentComplete, 0)}</span>
                      </div>
                      <Progress value={progress.percentComplete} />
                    </div>
                  ) : null}
                  <Link href={`/reader/${assignment.bookId}`}>
                    <Button size="sm">Continue in reader</Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
