import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

type RouteContext = {
  params: Promise<{ classId: string }>;
};

function csvEscape(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(_req: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user || session.user.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { classId } = await context.params;

  const klass = await prisma.class.findFirst({
    where: { id: classId, instructorId: session.user.id },
    include: {
      enrollments: {
        include: { user: { select: { name: true, email: true, id: true } } },
      },
      assignments: { select: { id: true, title: true, bookId: true } },
    },
  });

  if (!klass) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const studentIds = klass.enrollments.map((e) => e.userId);
  const bookIds = klass.assignments.map((a) => a.bookId);

  const [progressRows, attempts, events] = await Promise.all([
    prisma.readingProgress.findMany({
      where: { userId: { in: studentIds }, bookId: { in: bookIds } },
    }),
    prisma.attempt.findMany({
      where: { userId: { in: studentIds }, bookId: { in: bookIds }, completed: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.analyticsEvent.findMany({
      where: { userId: { in: studentIds } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const header = [
    "name",
    "email",
    "avg_completion_pct",
    "last_activity",
    "latest_quiz_pct",
    "at_risk",
    "assignments_summary",
  ];

  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const rows: string[] = [header.join(",")];

  for (const enrollment of klass.enrollments) {
    const uid = enrollment.userId;
    const userProgress = progressRows.filter((p) => p.userId === uid);
    const avgCompletion =
      userProgress.length === 0
        ? 0
        : userProgress.reduce((s, p) => s + p.percentComplete, 0) /
          userProgress.length;

    let lastActivity: Date | null = null;
    for (const ev of events) {
      if (ev.userId === uid) {
        lastActivity = ev.createdAt;
        break;
      }
    }
    for (const p of userProgress) {
      if (!lastActivity || p.updatedAt > lastActivity) lastActivity = p.updatedAt;
    }

    const userAttempt = attempts.find((a) => a.userId === uid);
    const quizPct =
      userAttempt && userAttempt.maxScore > 0
        ? (userAttempt.score / userAttempt.maxScore) * 100
        : null;

    const inactive =
      !lastActivity || lastActivity.getTime() < sevenDaysAgo;
    const atRisk = avgCompletion < 30 || inactive;

    const assignmentParts = klass.assignments.map((assignment) => {
      const prog = userProgress.find((p) => p.bookId === assignment.bookId);
      const pct = prog?.percentComplete ?? 0;
      return `${assignment.title}:${pct.toFixed(0)}%`;
    });

    rows.push(
      [
        csvEscape(enrollment.user.name),
        csvEscape(enrollment.user.email),
        avgCompletion.toFixed(1),
        lastActivity ? lastActivity.toISOString() : "",
        quizPct !== null ? quizPct.toFixed(1) : "",
        atRisk ? "yes" : "no",
        csvEscape(assignmentParts.join("; ")),
      ].join(","),
    );
  }

  const body = rows.join("\n");
  const filename = `${klass.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-roster.csv`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
