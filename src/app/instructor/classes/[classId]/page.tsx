import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AssignBookForm,
  EnrollStudentForm,
} from "@/components/instructor/class-actions-forms";

type PageProps = {
  params: Promise<{ classId: string }>;
};

export default async function InstructorClassDetailPage({ params }: PageProps) {
  const { classId } = await params;
  const user = await requireRole("INSTRUCTOR");

  const klass = await prisma.class.findFirst({
    where: { id: classId, instructorId: user.id },
    include: {
      organization: true,
      enrollments: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      assignments: {
        include: { book: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!klass) notFound();

  const studentIds = klass.enrollments.map((e) => e.userId);
  const assignmentBookIds = klass.assignments.map((a) => a.bookId);

  const [progressRows, attempts, analyticsEvents, orgBooks] = await Promise.all([
    prisma.readingProgress.findMany({
      where: {
        userId: { in: studentIds },
        bookId: { in: assignmentBookIds.length ? assignmentBookIds : undefined },
      },
    }),
    prisma.attempt.findMany({
      where: {
        userId: { in: studentIds },
        bookId: { in: assignmentBookIds.length ? assignmentBookIds : undefined },
        completed: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.analyticsEvent.findMany({
      where: { userId: { in: studentIds } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.book.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          { organizationId: klass.organizationId },
          { isDemo: true },
        ],
      },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const progressByUser = new Map<string, typeof progressRows>();
  for (const p of progressRows) {
    const list = progressByUser.get(p.userId) ?? [];
    list.push(p);
    progressByUser.set(p.userId, list);
  }

  const attemptsByUser = new Map<string, typeof attempts>();
  for (const a of attempts) {
    const list = attemptsByUser.get(a.userId) ?? [];
    list.push(a);
    attemptsByUser.set(a.userId, list);
  }

  const lastActivityByUser = new Map<string, Date>();
  for (const ev of analyticsEvents) {
    if (!ev.userId) continue;
    if (!lastActivityByUser.has(ev.userId)) {
      lastActivityByUser.set(ev.userId, ev.createdAt);
    }
  }
  for (const p of progressRows) {
    const prev = lastActivityByUser.get(p.userId);
    if (!prev || p.updatedAt > prev) {
      lastActivityByUser.set(p.userId, p.updatedAt);
    }
  }

  const sevenDaysCutoff = new Date();
  sevenDaysCutoff.setUTCDate(sevenDaysCutoff.getUTCDate() - 7);
  const sevenDaysAgo = sevenDaysCutoff.getTime();

  const studentRows = klass.enrollments.map((enrollment) => {
    const uid = enrollment.userId;
    const userProgress = progressByUser.get(uid) ?? [];
    const avgCompletion =
      userProgress.length === 0
        ? 0
        : userProgress.reduce((s, p) => s + p.percentComplete, 0) /
          userProgress.length;

    const userAttempts = attemptsByUser.get(uid) ?? [];
    const latestAttempt = userAttempts[0];
    const quizPct =
      latestAttempt && latestAttempt.maxScore > 0
        ? (latestAttempt.score / latestAttempt.maxScore) * 100
        : null;

    const lastActivity = lastActivityByUser.get(uid);
    const inactive =
      !lastActivity || lastActivity.getTime() < sevenDaysAgo;
    const atRisk = avgCompletion < 30 || inactive;

    const assignmentStatus = klass.assignments.map((assignment) => {
      const prog = userProgress.find((p) => p.bookId === assignment.bookId);
      const done = (prog?.percentComplete ?? 0) >= 100;
      const overdue = assignment.dueAt && assignment.dueAt < new Date() && !done;
      return {
        assignmentId: assignment.id,
        title: assignment.title,
        bookTitle: assignment.book.title,
        percent: prog?.percentComplete ?? 0,
        done,
        overdue: !!overdue,
      };
    });

    return {
      user: enrollment.user,
      avgCompletion,
      lastActivity,
      quizPct,
      atRisk,
      assignmentStatus,
    };
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Link
            href="/instructor/classes"
            className="text-sm text-foreground hover:text-foreground"
          >
            ← All classes
          </Link>
          <h1 className="mt-2 page-title">{klass.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {klass.organization.name} · {klass.enrollments.length} students
          </p>
        </div>
        <Link href={`/instructor/classes/${klass.id}/export`}>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Enroll student</CardTitle>
            <CardDescription>Add a learner by email address</CardDescription>
          </CardHeader>
          <CardContent>
            <EnrollStudentForm classId={klass.id} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Assign book</CardTitle>
            <CardDescription>Create an assignment for this class</CardDescription>
          </CardHeader>
          <CardContent>
            <AssignBookForm classId={klass.id} books={orgBooks} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Learner progress</CardTitle>
          <CardDescription>
            Completion, quiz scores, and at-risk flags (&lt;30% or no activity in 7
            days)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {studentRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students enrolled yet.</p>
          ) : (
            studentRows.map((row) => (
              <div
                key={row.user.id}
                className="rounded-lg border border-neutral-100 px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{row.user.name}</p>
                    <p className="text-xs text-muted-foreground">{row.user.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.atRisk ? (
                      <Badge className="bg-neutral-100 text-foreground">At risk</Badge>
                    ) : (
                      <Badge className="bg-neutral-100 text-foreground">On track</Badge>
                    )}
                    {row.quizPct !== null ? (
                      <Badge className="bg-neutral-100 text-foreground">
                        Latest quiz {formatPercent(row.quizPct, 0)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Avg completion</span>
                    <span>{formatPercent(row.avgCompletion, 0)}</span>
                  </div>
                  <Progress value={row.avgCompletion} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Last activity:{" "}
                  {row.lastActivity ? formatDate(row.lastActivity) : "None recorded"}
                </p>
                {row.assignmentStatus.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm">
                    {row.assignmentStatus.map((a) => (
                      <li
                        key={a.assignmentId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-neutral-50 px-3 py-2"
                      >
                        <span>
                          {a.title} ({a.bookTitle})
                        </span>
                        <span className="flex items-center gap-2">
                          {formatPercent(a.percent, 0)}
                          {a.done ? (
                            <Badge className="bg-neutral-100 text-foreground">Done</Badge>
                          ) : a.overdue ? (
                            <Badge className="bg-neutral-100 text-foreground">Overdue</Badge>
                          ) : (
                            <Badge className="bg-neutral-100 text-foreground">In progress</Badge>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {klass.assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assignments yet.</p>
          ) : (
            klass.assignments.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap justify-between gap-2 rounded-lg border border-neutral-100 px-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">{a.title}</p>
                  <p className="text-muted-foreground">{a.book.title}</p>
                </div>
                <p className="text-muted-foreground">
                  {a.dueAt ? `Due ${formatDate(a.dueAt)}` : "No due date"}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
