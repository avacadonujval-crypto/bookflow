import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { formatPercent } from "@/lib/utils";
import { StatCard } from "@/components/layout/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export default async function InstructorReportsPage() {
  const user = await requireRole("INSTRUCTOR");

  const classes = await prisma.class.findMany({
    where: { instructorId: user.id },
    include: {
      _count: { select: { enrollments: true } },
      enrollments: { select: { userId: true } },
      assignments: { select: { bookId: true } },
    },
  });

  if (classes.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">Reports</h1>
        <EmptyState
          title="No report data yet"
          description="Create a class and enroll students to see progress summaries."
          action={
            <Link href="/instructor/classes">
              <Button size="sm">Go to classes</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const allStudentIds = [
    ...new Set(classes.flatMap((c) => c.enrollments.map((e) => e.userId))),
  ];
  const allBookIds = [
    ...new Set(classes.flatMap((c) => c.assignments.map((a) => a.bookId))),
  ];

  const [progressRows, attempts] = await Promise.all([
    prisma.readingProgress.findMany({
      where: {
        userId: { in: allStudentIds },
        ...(allBookIds.length ? { bookId: { in: allBookIds } } : {}),
      },
    }),
    prisma.attempt.findMany({
      where: {
        userId: { in: allStudentIds },
        completed: true,
        ...(allBookIds.length ? { bookId: { in: allBookIds } } : {}),
      },
    }),
  ]);

  const classSummaries = classes.map((cls) => {
    const studentIds = cls.enrollments.map((e) => e.userId);
    const bookIds = cls.assignments.map((a) => a.bookId);
    const relevantProgress = progressRows.filter(
      (p) =>
        studentIds.includes(p.userId) &&
        (bookIds.length === 0 || bookIds.includes(p.bookId)),
    );

    const avgCompletion =
      relevantProgress.length === 0
        ? 0
        : relevantProgress.reduce((s, p) => s + p.percentComplete, 0) /
          relevantProgress.length;

    const classAttempts = attempts.filter(
      (a) =>
        studentIds.includes(a.userId) &&
        (bookIds.length === 0 || bookIds.includes(a.bookId)),
    );
    const avgQuiz =
      classAttempts.length === 0
        ? 0
        : classAttempts.reduce(
            (s, a) =>
              s + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0),
            0,
          ) / classAttempts.length;

    const sevenDaysCutoff = new Date();
    sevenDaysCutoff.setUTCDate(sevenDaysCutoff.getUTCDate() - 7);
    const sevenDaysAgo = sevenDaysCutoff.getTime();
    let atRiskCount = 0;
    for (const sid of studentIds) {
      const userProg = relevantProgress.filter((p) => p.userId === sid);
      const avg =
        userProg.length === 0
          ? 0
          : userProg.reduce((s, p) => s + p.percentComplete, 0) / userProg.length;
      const lastUpdate = userProg.reduce<Date | null>((max, p) => {
        if (!max || p.updatedAt > max) return p.updatedAt;
        return max;
      }, null);
      const inactive = !lastUpdate || lastUpdate.getTime() < sevenDaysAgo;
      if (avg < 30 || inactive) atRiskCount += 1;
    }

    return {
      id: cls.id,
      name: cls.name,
      students: cls._count.enrollments,
      avgCompletion,
      avgQuiz,
      atRiskCount,
    };
  });

  const overallCompletion =
    classSummaries.reduce((s, c) => s + c.avgCompletion, 0) /
    classSummaries.length;
  const overallAtRisk = classSummaries.reduce((s, c) => s + c.atRiskCount, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          High-level progress across your BookFlow classes.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Classes" value={classes.length} />
        <StatCard
          label="Avg completion"
          value={formatPercent(overallCompletion, 0)}
        />
        <StatCard label="At-risk learners" value={overallAtRisk} />
        <StatCard label="Quiz attempts" value={attempts.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Class breakdown</CardTitle>
          <CardDescription>
            Average reading completion and quiz performance by cohort
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {classSummaries.map((cls) => (
            <div key={cls.id} className="rounded-lg border border-neutral-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{cls.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {cls.students} students · {cls.atRiskCount} at risk
                  </p>
                </div>
                <Link href={`/instructor/classes/${cls.id}`}>
                  <Button size="sm" variant="outline">
                    Details
                  </Button>
                </Link>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Avg completion</p>
                  <Progress value={cls.avgCompletion} />
                  <p className="mt-1 text-sm font-medium">
                    {formatPercent(cls.avgCompletion, 0)}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Avg quiz score</p>
                  <Progress value={cls.avgQuiz} />
                  <p className="mt-1 text-sm font-medium">
                    {formatPercent(cls.avgQuiz, 0)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
