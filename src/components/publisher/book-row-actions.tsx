"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  archiveBookForm,
  deleteBookForm,
  publishBookForm,
} from "@/lib/actions/books";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export function BookRowActions({
  bookId,
  status,
  bookTitle,
}: {
  bookId: string;
  status: string;
  bookTitle?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const label = bookTitle ? `“${bookTitle}”` : "this book";

  const handleDelete = () => {
    const fd = new FormData();
    fd.set("bookId", bookId);
    startTransition(async () => {
      await deleteBookForm(fd);
      setConfirmOpen(false);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/publisher/books/${bookId}`}>
        <Button size="sm" variant="outline">
          Edit
        </Button>
      </Link>
      <Link href={`/reader/${bookId}`}>
        <Button size="sm" variant="ghost">
          Preview
        </Button>
      </Link>
      {status !== "PUBLISHED" ? (
        <form
          action={(fd) => {
            startTransition(() => publishBookForm(fd));
          }}
        >
          <input type="hidden" name="bookId" value={bookId} />
          <Button size="sm" type="submit" disabled={pending}>
            Publish
          </Button>
        </form>
      ) : null}
      {status !== "ARCHIVED" ? (
        <form
          action={(fd) => {
            startTransition(() => archiveBookForm(fd));
          }}
        >
          <input type="hidden" name="bookId" value={bookId} />
          <Button size="sm" variant="secondary" type="submit" disabled={pending}>
            Archive
          </Button>
        </form>
      ) : null}
      <Button
        size="sm"
        variant="destructive"
        type="button"
        disabled={pending}
        data-testid="book-delete"
        onClick={() => setConfirmOpen(true)}
      >
        Delete
      </Button>

      <Modal
        open={confirmOpen}
        onClose={() => {
          if (!pending) setConfirmOpen(false);
        }}
        title="Delete book"
        subtitle="This action cannot be undone"
        size="md"
      >
        <div className="space-y-5 px-5 py-5">
          <p className="text-sm text-muted-foreground">
            Permanently delete {label}? The source file, cover, and related
            content will be removed from your catalog.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              data-testid="book-delete-confirm"
              onClick={handleDelete}
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
