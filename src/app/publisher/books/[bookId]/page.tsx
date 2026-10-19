import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight, Layers, PenLine } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import {
  archiveBookForm,
  publishBookForm,
  saveAsDraftForm,
  updateBookMetadataForm,
} from "@/lib/actions/books";
import { BookStatusBadge } from "@/components/publisher/book-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function coverSrc(url: string | null) {
  if (!url) return "/covers/sample-cover.svg";
  if (url.startsWith("/")) return url;
  return url;
}

export default async function PublisherBookDetailPage({
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
      versions: { orderBy: { version: "desc" }, take: 5 },
    },
  });

  if (!book) notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-lg border border-neutral-100 shadow-sm">
            <Image
              src={coverSrc(book.coverUrl)}
              alt=""
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="page-title">{book.title}</h1>
              <BookStatusBadge status={book.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">by {book.author}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Version {book.version} · Updated {formatDate(book.updatedAt)}
              {book.publishedAt
                ? ` · Published ${formatDate(book.publishedAt)}`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/reader/${book.id}`}>
            <Button variant="outline">Open PDF reader</Button>
          </Link>
          <Link href={`/publisher/books/${book.id}/author`}>
            <Button>
              <PenLine className="h-4 w-4" />
              Author chapters
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
            <CardDescription>
              Core catalog details shown to instructors and learners in BookFlow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateBookMetadataForm} className="space-y-4">
              <input type="hidden" name="bookId" value={book.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" name="title" defaultValue={book.title} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="author">Author</Label>
                  <Input
                    id="author"
                    name="author"
                    defaultValue={book.author}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Input
                    id="language"
                    name="language"
                    defaultValue={book.language}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    name="subject"
                    defaultValue={book.subject}
                    placeholder="e.g. Biology, Business"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    rows={5}
                    defaultValue={book.description}
                  />
                </div>
              </div>
              <Button type="submit">Save metadata</Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Publication</CardTitle>
              <CardDescription>Control visibility in the catalog.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {book.status !== "PUBLISHED" ? (
                <form action={publishBookForm}>
                  <input type="hidden" name="bookId" value={book.id} />
                  <input type="hidden" name="changelog" value="Published from book detail" />
                  <Button type="submit" className="w-full">
                    Publish book
                  </Button>
                </form>
              ) : (
                <form action={saveAsDraftForm}>
                  <input type="hidden" name="bookId" value={book.id} />
                  <Button type="submit" variant="secondary" className="w-full">
                    Revert to draft
                  </Button>
                </form>
              )}
              {book.status !== "ARCHIVED" ? (
                <form action={archiveBookForm}>
                  <input type="hidden" name="bookId" value={book.id} />
                  <Button type="submit" variant="outline" className="w-full">
                    Archive
                  </Button>
                </form>
              ) : null}
              {book.fileUrl ? (
                <p className="text-xs text-muted-foreground">
                  Source file: {book.fileType?.toUpperCase() ?? "file"}{" "}
                  <a
                    href={book.fileUrl}
                    className="text-foreground hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download
                  </a>
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Version history
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {book.versions.length === 0 ? (
                <p className="text-muted-foreground">No published versions yet.</p>
              ) : (
                book.versions.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-lg border border-neutral-100 px-3 py-2"
                  >
                    <p className="font-medium text-foreground">v{v.version}</p>
                    <p className="text-xs text-muted-foreground">{v.changelog}</p>
                    <p className="text-xs text-neutral-400">
                      {formatDate(v.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Chapters</CardTitle>
            <CardDescription>
              Open the authoring workspace to edit content and assessments.
            </CardDescription>
          </div>
          <Link href={`/publisher/books/${book.id}/author/elements`}>
            <Button variant="outline" size="sm">
              Interactive elements
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {book.chapters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No chapters yet. Use the upload wizard or authoring view to add chapters.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {book.chapters.map((ch) => (
                <li key={ch.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-foreground">
                      {ch.order + 1}. {ch.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Updated {formatDate(ch.updatedAt)}
                    </p>
                  </div>
                  <Link
                    href={`/publisher/books/${book.id}/author?chapter=${ch.id}`}
                  >
                    <Button size="sm" variant="ghost">
                      Edit
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
