import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function trackEvent(params: {
  type: string;
  userId?: string | null;
  bookId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return prisma.analyticsEvent.create({
    data: {
      type: params.type,
      userId: params.userId ?? null,
      bookId: params.bookId ?? null,
      metadata: (params.metadata ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
    },
  });
}

export async function getPublisherAnalytics(publisherId: string) {
  const books = await prisma.book.findMany({
    where: { publisherId },
    select: { id: true, title: true, status: true },
  });
  const bookIds = books.map((b) => b.id);

  const [
    opens,
    uniqueReaders,
    avgProgress,
    attempts,
    chapterEvents,
    highlights,
    searches,
    activity,
  ] = await Promise.all([
    prisma.analyticsEvent.count({
      where: { bookId: { in: bookIds }, type: "book_open" },
    }),
    prisma.analyticsEvent.findMany({
      where: { bookId: { in: bookIds }, type: "book_open", userId: { not: null } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.readingProgress.aggregate({
      where: { bookId: { in: bookIds } },
      _avg: { percentComplete: true, readingTimeSec: true },
    }),
    prisma.attempt.findMany({
      where: { bookId: { in: bookIds }, completed: true },
      select: { score: true, maxScore: true },
    }),
    prisma.analyticsEvent.findMany({
      where: { bookId: { in: bookIds }, type: "chapter_complete" },
      select: { metadata: true },
    }),
    prisma.highlight.groupBy({
      by: ["text"],
      where: { bookId: { in: bookIds } },
      _count: { text: true },
      orderBy: { _count: { text: "desc" } },
      take: 5,
    }),
    prisma.analyticsEvent.findMany({
      where: { bookId: { in: bookIds }, type: "search" },
      select: { metadata: true },
      take: 200,
      orderBy: { createdAt: "desc" },
    }),
    prisma.analyticsEvent.findMany({
      where: { bookId: { in: bookIds } },
      select: { createdAt: true, type: true },
      orderBy: { createdAt: "asc" },
      take: 500,
    }),
  ]);

  const avgScore =
    attempts.length === 0
      ? 0
      : (attempts.reduce(
          (sum, a) => sum + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0),
          0,
        ) /
          attempts.length);

  const chapterCompletion: Record<string, number> = {};
  for (const e of chapterEvents) {
    const meta = e.metadata as { chapterTitle?: string } | null;
    const key = meta?.chapterTitle || "Unknown";
    chapterCompletion[key] = (chapterCompletion[key] || 0) + 1;
  }

  const searchTerms: Record<string, number> = {};
  for (const s of searches) {
    const meta = s.metadata as { query?: string } | null;
    const q = meta?.query?.trim().toLowerCase();
    if (!q) continue;
    searchTerms[q] = (searchTerms[q] || 0) + 1;
  }

  const activityByDay: Record<string, number> = {};
  for (const a of activity) {
    const day = a.createdAt.toISOString().slice(0, 10);
    activityByDay[day] = (activityByDay[day] || 0) + 1;
  }

  return {
    books,
    bookOpens: opens,
    uniqueReaders: uniqueReaders.length,
    avgReadingTimeSec: avgProgress._avg.readingTimeSec ?? 0,
    avgCompletion: avgProgress._avg.percentComplete ?? 0,
    quizAttempts: attempts.length,
    avgScore,
    chapterCompletion,
    topHighlights: highlights.map((h) => ({ text: h.text, count: h._count.text })),
    topSearchTerms: Object.entries(searchTerms)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([term, count]) => ({ term, count })),
    activityOverTime: Object.entries(activityByDay).map(([date, count]) => ({
      date,
      count,
    })),
  };
}
