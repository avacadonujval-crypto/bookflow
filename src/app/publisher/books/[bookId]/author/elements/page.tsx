import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { InteractiveElementEditor } from "@/components/publisher/interactive-element-editor";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function PublisherBookElementsPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const user = await requireRole("PUBLISHER");
  const { bookId } = await params;

  const book = await prisma.book.findFirst({
    where: { id: bookId, publisherId: user.id },
    include: { chapters: { orderBy: { order: "asc" } } },
  });

  if (!book) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-foreground">
            BookFlow Elements
          </p>
          <h1 className="page-title">{book.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure assessments and rich content blocks with a live preview.
          </p>
        </div>
        <Link href={`/publisher/books/${book.id}/author`}>
          <Button variant="outline">Back to authoring</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Interactive element editor</CardTitle>
          <CardDescription>
            Choose a chapter, pick a question or media block type, and save to
            your BookFlow title.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
            <InteractiveElementEditor bookId={book.id} chapters={book.chapters} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
