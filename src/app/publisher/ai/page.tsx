import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import {
  AIAssistPanel,
  type AIRequestRow,
} from "@/components/publisher/ai-assist-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default async function PublisherAIPage() {
  const user = await requireRole("PUBLISHER");

  const [books, requestsRaw] = await Promise.all([
    prisma.book.findMany({
      where: { publisherId: user.id },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.aIGenerationRequest.findMany({
      where: { userId: user.id },
      include: { book: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const chapters =
    books.length === 0
      ? []
      : await prisma.chapter.findMany({
          where: { bookId: { in: books.map((b) => b.id) } },
          select: { id: true, bookId: true, title: true, order: true },
          orderBy: [{ bookId: "asc" }, { order: "asc" }],
        });

  const requests: AIRequestRow[] = requestsRaw.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    prompt: r.prompt,
    result: r.result,
    createdAt: r.createdAt.toISOString(),
    bookTitle: r.book?.title ?? null,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">AI Assist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Draft summaries, flashcards, and practice content. Every output stays in
          review until you approve it.
        </p>
      </div>

      {books.length === 0 ? (
        <EmptyState
          title="Add a book first"
          description="Upload or create a book before generating AI-assisted content."
          action={
            <Link href="/publisher/books?upload=1">
              <Button size="sm">Upload a book</Button>
            </Link>
          }
        />
      ) : (
        <AIAssistPanel books={books} chapters={chapters} requests={requests} />
      )}
    </div>
  );
}
