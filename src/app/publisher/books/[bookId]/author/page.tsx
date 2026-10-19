import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { ChapterAuthorForm } from "@/components/publisher/chapter-author-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function PublisherBookAuthorPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const user = await requireRole("PUBLISHER");
  const { bookId } = await params;

  const book = await prisma.book.findFirst({
    where: { id: bookId, publisherId: user.id },
    include: {
      chapters: { orderBy: { order: "asc" } },
    },
  });

  if (!book) notFound();

  const questions = await prisma.question.findMany({
    where: { chapterId: { in: book.chapters.map((c) => c.id) } },
    orderBy: { order: "asc" },
    select: { id: true, chapterId: true, type: true, prompt: true, order: true },
  });

  const questionsByChapter: Record<
    string,
    { id: string; type: string; prompt: string; order: number }[]
  > = {};
  for (const q of questions) {
    if (!questionsByChapter[q.chapterId]) {
      questionsByChapter[q.chapterId] = [];
    }
    questionsByChapter[q.chapterId].push(q);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-foreground">
            BookFlow Authoring
          </p>
          <h1 className="page-title">{book.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edit chapter HTML and manage inline assessments.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/publisher/books/${book.id}`}>
            <Button variant="outline">Book details</Button>
          </Link>
          <Link href={`/publisher/books/${book.id}/author/elements`}>
            <Button variant="secondary">Element editor</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chapter workspace</CardTitle>
          <CardDescription>
            Select a chapter, update reader content, and jump to the element editor
            for quizzes and rich media blocks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
            <ChapterAuthorForm
              bookId={book.id}
              chapters={book.chapters}
              questionsByChapter={questionsByChapter}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
