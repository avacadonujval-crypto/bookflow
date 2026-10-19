"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type PublisherAnalyticsChartsProps = {
  bookOpens: number;
  uniqueReaders: number;
  avgReadingTimeSec: number;
  quizAttempts: number;
  avgScore: number;
  chapterCompletion: { name: string; count: number }[];
  topHighlights: { text: string; count: number }[];
  topSearchTerms: { term: string; count: number }[];
  activityOverTime: { date: string; count: number }[];
};

function formatReadingTime(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

export function PublisherAnalyticsCharts(props: PublisherAnalyticsChartsProps) {
  const summaryMetrics = [
    { label: "Book opens", value: props.bookOpens },
    { label: "Unique readers", value: props.uniqueReaders },
    {
      label: "Avg reading time",
      value: formatReadingTime(props.avgReadingTimeSec),
    },
    { label: "Quiz attempts", value: props.quizAttempts },
    { label: "Avg quiz score", value: `${props.avgScore.toFixed(1)}%` },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summaryMetrics.map((m) => (
          <div
            key={m.label}
            className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {m.label}
            </p>
            <p className="stat-value mt-2">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Chapter completions" description="By chapter title">
          {props.chapterCompletion.length === 0 ? (
            <EmptyChartNote />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={props.chapterCompletion} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e8ed" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={70}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#000000" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Activity over time" description="All tracked events by day">
          {props.activityOverTime.length === 0 ? (
            <EmptyChartNote />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={props.activityOverTime} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e8ed" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#000000"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Top highlights" description="Most highlighted passages">
          {props.topHighlights.length === 0 ? (
            <EmptyChartNote />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={props.topHighlights.map((h) => ({
                  name: h.text.length > 36 ? `${h.text.slice(0, 36)}…` : h.text,
                  count: h.count,
                }))}
                layout="vertical"
                margin={{ left: 8, right: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e8ed" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip />
                <Bar dataKey="count" fill="#1d1d1f" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Top search terms" description="In-book search queries">
          {props.topSearchTerms.length === 0 ? (
            <EmptyChartNote />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={props.topSearchTerms} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e8ed" />
                <XAxis dataKey="term" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#86868b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function EmptyChartNote() {
  return (
    <p className="py-12 text-center text-sm text-muted-foreground">No data for this chart yet.</p>
  );
}
