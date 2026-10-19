import Link from "next/link";
import { BookOpen, Clock3 } from "lucide-react";
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
import { Button } from "@/components/ui/button";

export default async function PublisherDashboardPage() {
  const user = await requireRole("PUBLISHER");

  const books = await prisma.book.findMany({
    where: { publisherId: user.id },
    select: { id: true, status: true, title: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const bookIds = books.map((b) => b.id);
  const totalBooks = books.length;
  const draftBooks = books.filter((b) => b.status === "DRAFT").length;
  const publishedBooks = books.filter((b) => b.status === "PUBLISHED").length;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  const [
    activeLearnerGroups,
    avgCompletionAgg,
    completedAttempts,
    recentAuditLogs,
  ] = await Promise.all([
    bookIds.length
      ? prisma.readingProgress.groupBy({
          by: ["userId"],
          where: {
            bookId: { in: bookIds },
            percentComplete: { gt: 0 },
            updatedAt: { gte: thirtyDaysAgo },
          },
        })
      : Promise.resolve([]),
    bookIds.length
      ? prisma.readingProgress.aggregate({
          where: { bookId: { in: bookIds } },
          _avg: { percentComplete: true },
        })
      : Promise.resolve({ _avg: { percentComplete: 0 } }),
    bookIds.length
      ? prisma.attempt.findMany({
          where: { bookId: { in: bookIds }, completed: true },
          select: { score: true, maxScore: true },
        })
      : Promise.resolve([]),
    prisma.auditLog.findMany({
      where: bookIds.length
        ? {
            OR: [
              { userId: user.id },
              { entityType: "Book", entityId: { in: bookIds } },
            ],
          }
        : { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const avgCompletion = avgCompletionAgg._avg.percentComplete ?? 0;
  const avgAssessmentScore =
    completedAttempts.length === 0
      ? 0
      : completedAttempts.reduce(
          (sum, attempt) =>
            sum +
            (attempt.maxScore > 0
              ? (attempt.score / attempt.maxScore) * 100
              : 0),
          0,
        ) / completedAttempts.length;

  return (
    <div className="space-y-6 pb-2">
      <PageHeader
        title="Dashboard"
        description="Overview of your catalog, learners, and recent activity."
        actions={
          <Link href="/publisher/books?upload=1">
            <Button>Upload a book</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="animate-fade-up stagger-1">
          <StatCard label="Total books" value={totalBooks} />
        </div>
        <div className="animate-fade-up stagger-2">
          <StatCard label="Draft books" value={draftBooks} />
        </div>
        <div className="animate-fade-up stagger-3">
          <StatCard label="Published books" value={publishedBooks} />
        </div>
        <div className="animate-fade-up stagger-4">
          <StatCard
            label="Active learners (30d)"
            value={activeLearnerGroups.length}
            hint="Readers with progress on your titles"
          />
        </div>
        <div className="animate-fade-up stagger-5">
          <StatCard
            label="Avg completion"
            value={formatPercent(avgCompletion, 0)}
          />
        </div>
        <div className="animate-fade-up stagger-5">
          <StatCard
            label="Avg assessment score"
            value={formatPercent(avgAssessmentScore, 0)}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent titles</CardTitle>
            <CardDescription>Latest updates across your catalog</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {books.length === 0 ? (
              <EmptyState
                title="No books yet"
                description="Upload your first title to start tracking learner activity."
                action={
                  <Link href="/publisher/books?upload=1">
                    <Button size="sm">Upload book</Button>
                  </Link>
                }
              />
            ) : (
              books.slice(0, 6).map((book) => (
                <div
                  key={book.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 shrink-0 text-foreground" />
                      <span className="truncate font-medium text-foreground">
                        {book.title}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Updated {formatDate(book.updatedAt)}
                    </p>
                  </div>
                  <Badge
                    className={
                      book.status === "PUBLISHED"
                        ? "bg-neutral-100 text-foreground"
                        : book.status === "DRAFT"
                          ? "bg-neutral-100 text-muted-foreground"
                          : "bg-neutral-100 text-neutral-700"
                    }
                  >
                    {book.status.toLowerCase()}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent audit activity</CardTitle>
            <CardDescription>Latest actions across your workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAuditLogs.length === 0 ? (
              <EmptyState
                title="No activity yet"
                description="Audit events will appear here as you publish and manage content."
              />
            ) : (
              recentAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-neutral-100 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {log.action}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.entityType}
                        {log.entityId ? ` · ${log.entityId.slice(0, 8)}…` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatDate(log.createdAt)}
                    </div>
                  </div>
                  {log.user?.name ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      by {log.user.name}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
