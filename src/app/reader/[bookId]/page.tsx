import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, ROLE_HOME } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { userHasBookAccess } from "@/lib/services/license";
import { trackEvent } from "@/lib/services/analytics";
import { EbookReader } from "@/components/reader/ebook-reader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PageProps = {
  params: Promise<{ bookId: string }>;
};

export const dynamic = "force-dynamic";

export default async function ReaderPage({ params }: PageProps) {
  const { bookId } = await params;
  const user = await requireUser();

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      chapters: { orderBy: { order: "asc" } },
    },
  });

  if (!book) notFound();

  const access = await userHasBookAccess(user.id, bookId);

  if (!access.allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>License required</CardTitle>
            <CardDescription>
              {book.isDemo
                ? "This demo title is not available for your account right now."
                : `You need a license or assignment to open "${book.title}" in BookFlow.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link href={ROLE_HOME[user.role]}>
              <Button variant="outline">Back to dashboard</Button>
            </Link>
            {user.role === "STUDENT" ? (
              <Link href="/student/library">
                <Button>Browse library</Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  const [questions, progress, bookmarks, highlights, notes] = await Promise.all([
    prisma.question.findMany({
      where: { chapter: { bookId } },
      include: { options: { orderBy: { order: "asc" } } },
      orderBy: [{ chapterId: "asc" }, { order: "asc" }],
    }),
    prisma.readingProgress.findUnique({
      where: { userId_bookId: { userId: user.id, bookId } },
    }),
    prisma.bookmark.findMany({
      where: { userId: user.id, bookId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.highlight.findMany({
      where: { userId: user.id, bookId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.note.findMany({
      where: { userId: user.id, bookId },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  await trackEvent({
    type: "book_open",
    userId: user.id,
    bookId,
    metadata: { title: book.title },
  });

  const homeHref = ROLE_HOME[user.role];

  return (
    <EbookReader
      bookId={book.id}
      bookTitle={book.title}
      homeHref={homeHref}
      fileUrl={book.fileUrl}
      fileType={book.fileType}
      chapters={book.chapters.map((c) => ({
        id: c.id,
        title: c.title,
        order: c.order,
        content: c.content,
      }))}
      questions={questions.map((q) => ({
        id: q.id,
        chapterId: q.chapterId,
        type: q.type,
        prompt: q.prompt,
        explanation: q.explanation,
        feedback: q.feedback,
        points: q.points,
        order: q.order,
        correctText: q.correctText,
        matchingJson: (q.matchingJson as Record<string, string> | null) ?? null,
        options: q.options.map((o) => ({
          id: o.id,
          label: o.label,
          order: o.order,
        })),
      }))}
      initialChapterId={progress?.chapterId}
      initialPercent={progress?.percentComplete ?? 0}
      bookmarks={bookmarks.map((b) => ({
        id: b.id,
        chapterId: b.chapterId,
        label: b.label,
        location: b.location,
        createdAt: b.createdAt.toISOString(),
      }))}
      highlights={highlights.map((h) => ({
        id: h.id,
        chapterId: h.chapterId,
        text: h.text,
        color: h.color,
        createdAt: h.createdAt.toISOString(),
      }))}
      notes={notes.map((n) => ({
        id: n.id,
        chapterId: n.chapterId,
        body: n.body,
        updatedAt: n.updatedAt.toISOString(),
      }))}
    />
  );
}
