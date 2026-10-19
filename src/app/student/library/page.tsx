import Link from "next/link";
import { BookOpen } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { userHasBookAccess } from "@/lib/services/license";
import { formatPercent } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default async function StudentLibraryPage() {
  const user = await requireRole("STUDENT");

  const [enrollments, directLicenses, progressRows, orgLicensedBooks] =
    await Promise.all([
      prisma.enrollment.findMany({
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
                      author: true,
                      coverUrl: true,
                      isDemo: true,
                      status: true,
                      fileUrl: true,
                    },
                  },
                },
              },
              licenses: {
                where: { isActive: true },
                include: {
                  book: {
                    select: {
                      id: true,
                      title: true,
                      author: true,
                      coverUrl: true,
                      isDemo: true,
                      status: true,
                      fileUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.license.findMany({
        where: { userId: user.id, isActive: true },
        include: {
          book: {
            select: {
              id: true,
              title: true,
              author: true,
              coverUrl: true,
              isDemo: true,
              status: true,
              fileUrl: true,
            },
          },
        },
      }),
      prisma.readingProgress.findMany({
        where: { userId: user.id },
      }),
      prisma.book.findMany({
        where: {
          status: "PUBLISHED",
          licenses: {
            some: {
              isActive: true,
              scope: "ORGANIZATION",
              organization: { memberships: { some: { userId: user.id } } },
            },
          },
        },
        select: {
          id: true,
          title: true,
          author: true,
          coverUrl: true,
          isDemo: true,
          status: true,
          fileUrl: true,
        },
      }),
    ]);

  type BookEntry = {
    id: string;
    title: string;
    author: string;
    coverUrl: string | null;
    fileUrl: string | null;
    source: string;
  };

  const booksMap = new Map<string, BookEntry>();

  for (const enrollment of enrollments) {
    for (const assignment of enrollment.class.assignments) {
      if (assignment.book.status !== "PUBLISHED") continue;
      booksMap.set(assignment.book.id, {
        id: assignment.book.id,
        title: assignment.book.title,
        author: assignment.book.author,
        coverUrl: assignment.book.coverUrl,
        fileUrl: assignment.book.fileUrl,
        source: "Assignment",
      });
    }
    for (const license of enrollment.class.licenses) {
      if (license.book.status !== "PUBLISHED") continue;
      booksMap.set(license.book.id, {
        id: license.book.id,
        title: license.book.title,
        author: license.book.author,
        coverUrl: license.book.coverUrl,
        fileUrl: license.book.fileUrl,
        source: "Class license",
      });
    }
  }

  for (const license of directLicenses) {
    if (license.book.status !== "PUBLISHED") continue;
    booksMap.set(license.book.id, {
      id: license.book.id,
      title: license.book.title,
      author: license.book.author,
      coverUrl: license.book.coverUrl,
      fileUrl: license.book.fileUrl,
      source: "Personal license",
    });
  }

  for (const book of orgLicensedBooks) {
    if (!booksMap.has(book.id)) {
      booksMap.set(book.id, {
        id: book.id,
        title: book.title,
        author: book.author,
        coverUrl: book.coverUrl,
        fileUrl: book.fileUrl,
        source: "Organization",
      });
    }
  }

  const demoBooks = await prisma.book.findMany({
    where: { isDemo: true, status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      author: true,
      coverUrl: true,
      fileUrl: true,
    },
  });

  for (const demo of demoBooks) {
    if (!booksMap.has(demo.id)) {
      booksMap.set(demo.id, {
        ...demo,
        source: "Demo",
      });
    }
  }

  const progressByBook = new Map(progressRows.map((p) => [p.bookId, p]));

  const books = await Promise.all(
    Array.from(booksMap.values()).map(async (book) => {
      const access = await userHasBookAccess(user.id, book.id);
      return { ...book, allowed: access.allowed };
    }),
  );

  const accessible = books.filter((b) => b.allowed);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Click any book to open the PDF reader with AI assist.
        </p>
      </div>

      {accessible.length === 0 ? (
        <EmptyState
          title="No books in your library"
          description="Ask your publisher to publish a book — it will appear here automatically for your organization."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accessible.map((book) => {
            const progress = progressByBook.get(book.id);
            return (
              <Link
                key={book.id}
                href={`/reader/${book.id}`}
                className="block"
                data-testid="library-book-card"
              >
                <Card className="h-full transition hover:border-black hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-9 shrink-0 items-center justify-center rounded bg-neutral-100">
                        <BookOpen className="h-5 w-5 text-foreground" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base leading-snug">
                          {book.title}
                        </CardTitle>
                        <CardDescription>{book.author}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Badge className="bg-neutral-100 text-neutral-700">
                      {book.source}
                    </Badge>
                    {progress ? (
                      <div>
                        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                          <span>Progress</span>
                          <span>
                            {formatPercent(progress.percentComplete, 0)}
                          </span>
                        </div>
                        <Progress value={progress.percentComplete} />
                      </div>
                    ) : null}
                    <p className="text-sm font-semibold text-foreground">
                      {book.fileUrl ? "Open PDF reader →" : "Open reader →"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
