import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { getPublisherAnalytics } from "@/lib/services/analytics";
import { PublisherAnalyticsCharts } from "@/components/publisher/analytics-charts";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default async function PublisherAnalyticsPage() {
  const user = await requireRole("PUBLISHER");
  const data = await getPublisherAnalytics(user.id);

  const hasData =
    data.books.length > 0 &&
    (data.bookOpens > 0 ||
      data.uniqueReaders > 0 ||
      data.quizAttempts > 0 ||
      data.activityOverTime.length > 0);

  const chapterCompletion = Object.entries(data.chapterCompletion).map(
    ([name, count]) => ({ name, count }),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Engagement across your published titles — opens, reading time, quizzes, and
          learner activity.
        </p>
      </div>

      {!hasData ? (
        <EmptyState
          title="No analytics yet"
          description="When learners open your books, complete chapters, and take quizzes, metrics will appear here."
          action={
            <Link href="/publisher/books">
              <Button size="sm">View books</Button>
            </Link>
          }
        />
      ) : (
        <PublisherAnalyticsCharts
          bookOpens={data.bookOpens}
          uniqueReaders={data.uniqueReaders}
          avgReadingTimeSec={data.avgReadingTimeSec}
          quizAttempts={data.quizAttempts}
          avgScore={data.avgScore}
          chapterCompletion={chapterCompletion}
          topHighlights={data.topHighlights}
          topSearchTerms={data.topSearchTerms}
          activityOverTime={data.activityOverTime}
        />
      )}
    </div>
  );
}
