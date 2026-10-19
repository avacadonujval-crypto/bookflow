import Link from "next/link";
import { BookOpen, CalendarDays } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { formatDate, formatPercent } from "@/lib/utils";
import { StatCard } from "@/components/layout/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
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

export default async function StudentDashboardPage() {
  const user = await requireRole("STUDENT");

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    include: {
      class: {
        include: {
          assignments: {
            include: {
              book: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  fileUrl: true,
                },
              },
            },
            orderBy: { dueAt: "asc" },
          },
        },
      },
    },
  });

  const assignedBooksMap = new Map<
    string,
    {
      id: string;
      title: string;
      dueAt: Date | null;
      assignmentTitle: string;
      fileUrl: string | null;
    }
  >();

  for (const enrollment of enrollments) {
    for (const assignment of enrollment.class.assignments) {
      if (assignment.book.status !== "PUBLISHED") continue;
      assignedBooksMap.set(assignment.book.id, {
        id: assignment.book.id,
        title: assignment.book.title,
        dueAt: assignment.dueAt,
        assignmentTitle: assignment.title,
        fileUrl: assignment.book.fileUrl,
      });
    }
  }

  const assignedBooks = Array.from(assignedBooksMap.values());
  const now = new Date();
  const upcomingAssignments = assignedBooks
    .filter((book) => !book.dueAt || book.dueAt >= now)
    .sort((a, b) => {
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return a.dueAt.getTime() - b.dueAt.getTime();
    })
    .slice(0, 6);

  const [continueReading, recentAttempts, libraryBooks] = await Promise.all([
    prisma.readingProgress.findMany({
      where: {
        userId: user.id,
        percentComplete: { lt: 100 },
        book: { status: "PUBLISHED" },
      },
      include: {
        book: {
          select: { id: true, title: true, coverUrl: true, fileUrl: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.attempt.findMany({
      where: { userId: user.id },
      include: { book: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.book.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          { isDemo: true },
          {
            licenses: {
              some: {
                isActive: true,
                OR: [
                  { scope: "USER", userId: user.id },
                  {
                    scope: "CLASS",
                    class: { enrollments: { some: { userId: user.id } } },
                  },
                  {
                    scope: "ORGANIZATION",
                    organization: {
                      memberships: { some: { userId: user.id } },
                    },
                  },
                ],
              },
            },
          },
          {
            assignments: {
              some: {
                class: { enrollments: { some: { userId: user.id } } },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        author: true,
        fileUrl: true,
        coverUrl: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
  ]);

  const avgRecentScore =
    recentAttempts.length === 0
      ? 0
      : recentAttempts.reduce(
          (sum, attempt) =>
            sum +
            (attempt.maxScore > 0
              ? (attempt.score / attempt.maxScore) * 100
              : 0),
          0,
        ) / recentAttempts.length;

  return (
    <div className="space-y-6 pb-2">
      <PageHeader
        title="Dashboard"
        description="Open a book to read, practice, and study with AI grounded in the PDF."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="animate-fade-up stagger-1">
          <StatCard label="Assigned books" value={assignedBooks.length} />
        </div>
        <div className="animate-fade-up stagger-2">
          <StatCard label="In progress" value={continueReading.length} />
        </div>
        <div className="animate-fade-up stagger-3">
          <StatCard
            label="Upcoming assignments"
            value={upcomingAssignments.length}
          />
        </div>
        <div className="animate-fade-up stagger-4">
          <StatCard
            label="Recent avg score"
            value={formatPercent(avgRecentScore, 0)}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your books</CardTitle>
          <CardDescription>
            Click a book card to open the PDF in BookFlow
          </CardDescription>
        </CardHeader>
        <CardContent>
          {libraryBooks.length === 0 ? (
            <EmptyState
              title="No books yet"
              description="When a publisher publishes a title for your organization, it appears here."
              action={
                <Link href="/student/library">
                  <Button size="sm">Open library</Button>
                </Link>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {libraryBooks.map((book) => (
                <Link
                  key={book.id}
                  href={`/reader/${book.id}`}
                  className="block rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-black hover:shadow-md"
                  data-testid="student-book-card"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-9 shrink-0 items-center justify-center rounded bg-neutral-100">
                      <BookOpen className="h-5 w-5 text-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {book.title}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {book.author}
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {book.fileUrl ? "Open PDF reader →" : "Open reader →"}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Continue reading</CardTitle>
            <CardDescription>Resume titles with saved progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {continueReading.length === 0 ? (
              <EmptyState
                title="Nothing in progress"
                description="Open a book from Your books above to start reading."
              />
            ) : (
              continueReading.map((item) => (
                <Link
                  key={item.id}
                  href={`/reader/${item.book.id}`}
                  className="block rounded-lg border border-neutral-100 px-3 py-3 transition hover:border-black hover:bg-neutral-100/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 shrink-0 text-foreground" />
                        <p className="truncate font-medium text-foreground">
                          {item.book.title}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Updated {formatDate(item.updatedAt)}
                      </p>
                    </div>
                    <Badge className="bg-neutral-100 text-foreground">
                      {formatPercent(item.percentComplete, 0)}
                    </Badge>
                  </div>
                  <Progress value={item.percentComplete} className="mt-3" />
                  <p className="mt-3 text-sm font-medium text-foreground">
                    Continue in PDF reader →
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming assignments</CardTitle>
            <CardDescription>Assigned books and due dates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingAssignments.length === 0 ? (
              <EmptyState
                title="No upcoming assignments"
                description="Published books assigned to your class will show here."
              />
            ) : (
              upcomingAssignments.map((book) => (
                <Link
                  key={book.id}
                  href={`/reader/${book.id}`}
                  className="block rounded-lg border border-neutral-100 px-3 py-3 transition hover:border-black hover:bg-neutral-100/40"
                >
                  <p className="font-medium text-foreground">{book.title}</p>
                  <p className="text-sm text-muted-foreground">{book.assignmentTitle}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {book.dueAt
                        ? `Due ${formatDate(book.dueAt)}`
                        : "No due date"}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      Open PDF →
                    </span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent scores</CardTitle>
          <CardDescription>Your latest completed assessments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentAttempts.length === 0 ? (
            <EmptyState
              title="No scores yet"
              description="Complete chapter assessments to see results here."
            />
          ) : (
            recentAttempts.map((attempt) => {
              const pct =
                attempt.maxScore > 0
                  ? (attempt.score / attempt.maxScore) * 100
                  : 0;
              return (
                <Link
                  key={attempt.id}
                  href={`/reader/${attempt.book.id}`}
                  className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-3 transition hover:border-black hover:bg-neutral-100/40"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {attempt.book.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(attempt.createdAt)}
                    </p>
                  </div>
                  <Badge className="bg-neutral-100 text-foreground">
                    {formatPercent(pct, 0)}
                  </Badge>
                </Link>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
