import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { BookStatus, type Prisma } from "@prisma/client";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { BookStatusBadge } from "@/components/publisher/book-status-badge";
import { BookRowActions } from "@/components/publisher/book-row-actions";
import { BooksUploadButton } from "@/components/publisher/books-upload-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

const PAGE_SIZE = 12;

type SearchParams = Promise<{
  q?: string;
  status?: string;
  page?: string;
  upload?: string;
}>;

function coverSrc(url: string | null) {
  if (!url) return "/covers/sample-cover.svg";
  if (url.startsWith("/")) return url;
  return url;
}

export default async function PublisherBooksPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("PUBLISHER");
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const statusParam = params.status?.toUpperCase();
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const statusFilter =
    statusParam && Object.values(BookStatus).includes(statusParam as BookStatus)
      ? (statusParam as BookStatus)
      : undefined;

  const where: Prisma.BookWhereInput = {
    publisherId: user.id,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { author: { contains: q, mode: "insensitive" } },
            { subject: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, books] = await Promise.all([
    prisma.book.count({ where }),
    prisma.book.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const uploadButton = (
    <Suspense fallback={<Button disabled>Upload book</Button>}>
      <BooksUploadButton publisherName={user.name} />
    </Suspense>
  );

  return (
    <div className="space-y-6 pb-2">
      <PageHeader
        title="Books"
        description="Manage your catalog, drafts, and published titles."
        actions={uploadButton}
      />

      <Card>
        <CardHeader>
          <CardTitle>Library</CardTitle>
          <CardDescription>
            {total} title{total === 1 ? "" : "s"} in your workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            method="get"
          >
            <div className="flex-1 space-y-1">
              <label
                htmlFor="q"
                className="type-small font-medium text-muted-foreground"
              >
                Search
              </label>
              <Input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Title, author, or subject"
              />
            </div>
            <div className="space-y-1 sm:w-40">
              <label
                htmlFor="status"
                className="type-small font-medium text-muted-foreground"
              >
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={statusFilter ?? ""}
                className="flex h-11 w-full rounded-[1.25rem] border border-neutral-300 bg-white px-3.5 text-sm text-foreground focus-visible:border-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
              >
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <Button type="submit" variant="secondary">
              Apply
            </Button>
          </form>

          {books.length === 0 ? (
            <EmptyState
              title="No books found"
              description={
                q || statusFilter
                  ? "Try adjusting your search or filters."
                  : "Upload your first title to get started with BookFlow."
              }
              action={
                <Suspense fallback={null}>
                  <BooksUploadButton
                    publisherName={user.name}
                    label="Upload book"
                    size="sm"
                  />
                </Suspense>
              }
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-3 pr-4 font-medium">Title</th>
                      <th className="pb-3 pr-4 font-medium">Subject</th>
                      <th className="pb-3 pr-4 font-medium">Language</th>
                      <th className="pb-3 pr-4 font-medium">Status</th>
                      <th className="pb-3 pr-4 font-medium">Version</th>
                      <th className="pb-3 pr-4 font-medium">Updated</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {books.map((book) => (
                      <tr key={book.id} className="align-middle">
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-[0.85rem] border border-neutral-100 bg-neutral-50">
                              <Image
                                src={coverSrc(book.coverUrl)}
                                alt=""
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">
                                {book.title}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {book.author}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-muted-foreground">
                          {book.subject || "—"}
                        </td>
                        <td className="py-4 pr-4 text-muted-foreground">
                          {book.language}
                        </td>
                        <td className="py-4 pr-4">
                          <BookStatusBadge status={book.status} />
                        </td>
                        <td className="py-4 pr-4 text-muted-foreground">
                          v{book.version}
                        </td>
                        <td className="py-4 pr-4 text-muted-foreground">
                          {formatDate(book.updatedAt)}
                        </td>
                        <td className="py-4">
                          <BookRowActions
                            bookId={book.id}
                            status={book.status}
                            bookTitle={book.title}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 md:hidden">
                {books.map((book) => (
                  <div
                    key={book.id}
                    className="rounded-[1.5rem] border border-neutral-100 p-4"
                  >
                    <div className="flex gap-3">
                      <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-[1rem] border border-neutral-100">
                        <Image
                          src={coverSrc(book.coverUrl)}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-foreground">
                              {book.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {book.author}
                            </p>
                          </div>
                          <BookStatusBadge status={book.status} />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {book.subject || "General"} · {book.language} · v
                          {book.version} · {formatDate(book.updatedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <BookRowActions
                        bookId={book.id}
                        status={book.status}
                        bookTitle={book.title}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 ? (
                <div className="flex items-center justify-between border-t border-neutral-100 pt-4 text-sm">
                  <p className="text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    {page > 1 ? (
                      <Link
                        href={{
                          pathname: "/publisher/books",
                          query: {
                            ...(q ? { q } : {}),
                            ...(statusFilter ? { status: statusFilter } : {}),
                            page: page - 1,
                          },
                        }}
                      >
                        <Button size="sm" variant="outline">
                          Previous
                        </Button>
                      </Link>
                    ) : null}
                    {page < totalPages ? (
                      <Link
                        href={{
                          pathname: "/publisher/books",
                          query: {
                            ...(q ? { q } : {}),
                            ...(statusFilter ? { status: statusFilter } : {}),
                            page: page + 1,
                          },
                        }}
                      >
                        <Button size="sm" variant="outline">
                          Next
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
