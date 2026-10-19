"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import {
  createBookDraft,
  publishBook,
  updateBookMetadata,
  uploadBookFile,
  uploadCover,
  type BookActionState,
} from "@/lib/actions/books";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

const STEPS = [
  "Upload file",
  "Metadata",
  "Cover",
  "Interactive",
  "Preview",
  "Publish",
] as const;

type Metadata = {
  title: string;
  author: string;
  description: string;
  subject: string;
  language: string;
};

export function UploadWizard({
  publisherName,
  onFinished,
}: {
  publisherName: string;
  /** Called after publish when used inside a modal. */
  onFinished?: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [bookId, setBookId] = useState<string | null>(null);
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sourceUploaded, setSourceUploaded] = useState(false);
  const [coverPreview, setCoverPreview] = useState("/covers/sample-cover.svg");
  const [metadata, setMetadata] = useState<Metadata>({
    title: "",
    author: publisherName,
    description: "",
    subject: "",
    language: "en",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const progress = useMemo(
    () => Math.round(((step + 1) / STEPS.length) * 100),
    [step],
  );
  const isLast = step >= STEPS.length - 1;

  const runAction = useCallback(
    async (
      action: (
        prev: BookActionState,
        fd: FormData,
      ) => Promise<BookActionState>,
      fd: FormData,
    ) => {
      setError(null);
      setMessage(null);
      const result = await action({ ok: false }, fd);
      if (!result.ok) {
        setError(result.message ?? "Something went wrong");
        return result;
      }
      if (result.message) setMessage(result.message);
      if (result.bookId) setBookId(result.bookId);
      return result;
    },
    [],
  );

  const bookIdRef = useRef<string | null>(null);
  bookIdRef.current = bookId;

  const ensureBook = async () => {
    if (bookIdRef.current) return bookIdRef.current;
    const fd = new FormData();
    fd.set("title", metadata.title || "Untitled draft");
    fd.set("author", metadata.author || publisherName);
    fd.set("description", metadata.description);
    fd.set("subject", metadata.subject);
    fd.set("language", metadata.language);
    const result = await runAction(createBookDraft, fd);
    if (result.ok && result.bookId) {
      bookIdRef.current = result.bookId;
    }
    return result?.bookId ?? null;
  };

  const goNext = () => {
    startTransition(async () => {
      setError(null);
      setMessage(null);

      if (step === 0) {
        const file = bookFile ?? fileInputRef.current?.files?.[0] ?? null;
        if (!sourceUploaded) {
          if (!file) {
            setError("Choose a PDF or EPUB file to continue.");
            return;
          }
          setBookFile(file);
          setFileName(file.name);
          const id = await ensureBook();
          if (!id) return;
          const fd = new FormData();
          fd.set("bookId", id);
          fd.set("file", file);
          const result = await runAction(uploadBookFile, fd);
          if (!result.ok) return;
          setSourceUploaded(true);
        }
        setStep(1);
        return;
      }

      if (step === 1) {
        if (!metadata.title.trim()) {
          setError("Add a title to continue.");
          return;
        }
        const id = await ensureBook();
        if (!id) return;
        const fd = new FormData();
        fd.set("bookId", id);
        fd.set("title", metadata.title);
        fd.set("author", metadata.author);
        fd.set("description", metadata.description);
        fd.set("subject", metadata.subject);
        fd.set("language", metadata.language);
        const result = await runAction(updateBookMetadata, fd);
        if (!result.ok) return;
        setStep(2);
        return;
      }

      if (step === 2) {
        const id = await ensureBook();
        if (!id) return;
        const coverFile = coverInputRef.current?.files?.[0];
        const fd = new FormData();
        fd.set("bookId", id);
        if (coverFile && coverFile.size > 0) {
          setCoverPreview(URL.createObjectURL(coverFile));
          fd.set("file", coverFile);
        } else {
          fd.set("useDefault", "true");
          setCoverPreview("/covers/sample-cover.svg");
        }
        const result = await runAction(uploadCover, fd);
        if (!result.ok) return;
        setStep(3);
        return;
      }

      if (step === 3 || step === 4) {
        setStep((s) => s + 1);
        return;
      }

      if (step === 5) {
        const id = await ensureBook();
        if (!id) return;
        const fd = new FormData();
        fd.set("bookId", id);
        fd.set("changelog", "Initial publication via upload wizard");
        const result = await runAction(publishBook, fd);
        if (!result.ok) return;
        if (onFinished) onFinished();
        router.refresh();
        router.push(`/publisher/books/${id}`);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </span>
          {bookId ? (
            <span className="text-xs text-neutral-400">
              Book ID: {bookId.slice(0, 8)}…
            </span>
          ) : null}
        </div>
        <Progress value={progress} className="mt-2" />
        <div className="mt-3 flex flex-wrap gap-2">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i)}
              className={`rounded-full px-3 py-1 text-xs ${
                i === step
                  ? "bg-black text-white"
                  : "bg-neutral-100 text-muted-foreground hover:bg-neutral-200"
              }`}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="rounded-[1.15rem] bg-neutral-100 px-3 py-2 text-sm text-foreground">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-[1.15rem] bg-neutral-100 px-3 py-2 text-sm text-foreground">
          {message}
        </p>
      ) : null}

      {step === 0 ? (
        <section className="space-y-4">
          <p className="type-small">
            Upload a PDF or EPUB source file. BookFlow creates a draft title on
            this step if one does not exist yet.
          </p>
          <div className="space-y-2">
            <Label htmlFor="file">Book file</Label>
            <Input
              ref={fileInputRef}
              id="file"
              name="file"
              type="file"
              accept=".pdf,.epub,application/pdf,application/epub+zip"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setBookFile(file);
                setFileName(file?.name ?? null);
                setSourceUploaded(false);
              }}
            />
          </div>
          {fileName ? (
            <p className="type-small">
              {sourceUploaded ? "Uploaded: " : "Selected: "}
              {fileName}
            </p>
          ) : null}
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={metadata.title}
                onChange={(e) =>
                  setMetadata((m) => ({ ...m, title: e.target.value }))
                }
                placeholder="Introduction to BookFlow"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author">Author</Label>
              <Input
                id="author"
                value={metadata.author}
                onChange={(e) =>
                  setMetadata((m) => ({ ...m, author: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Input
                id="language"
                value={metadata.language}
                onChange={(e) =>
                  setMetadata((m) => ({ ...m, language: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={metadata.subject}
                onChange={(e) =>
                  setMetadata((m) => ({ ...m, subject: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={4}
                value={metadata.description}
                onChange={(e) =>
                  setMetadata((m) => ({ ...m, description: e.target.value }))
                }
              />
            </div>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4">
          <p className="type-small">
            Optional — pick a cover image, or continue to use the BookFlow sample
            cover.
          </p>
          <div className="flex gap-4">
            <div className="relative h-40 w-28 overflow-hidden rounded-[1.15rem] border border-neutral-100">
              <Image
                src={coverPreview}
                alt="Cover preview"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="cover">Cover image</Label>
              <Input
                ref={coverInputRef}
                id="cover"
                name="file"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setCoverPreview(URL.createObjectURL(file));
                }}
              />
            </div>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4 type-small">
          <p>
            Add quizzes, reflections, video blocks, glossaries, and more from the
            element editor after you finish — or open it now if your draft is
            ready.
          </p>
          {bookId ? (
            <Link href={`/publisher/books/${bookId}/author/elements`}>
              <Button variant="outline">Open interactive element editor</Button>
            </Link>
          ) : (
            <p>Complete an earlier step to create your draft first.</p>
          )}
        </section>
      ) : null}

      {step === 4 ? (
        <section className="rounded-[1.25rem] border border-neutral-100 bg-neutral-50 p-4 text-sm">
          <h3 className="page-title">Summary</h3>
          <ul className="mt-3 space-y-1 text-neutral-700">
            <li>
              <strong>Title:</strong> {metadata.title || "Untitled draft"}
            </li>
            <li>
              <strong>Author:</strong> {metadata.author}
            </li>
            <li>
              <strong>Subject:</strong> {metadata.subject || "—"}
            </li>
            <li>
              <strong>Language:</strong> {metadata.language}
            </li>
            <li>
              <strong>Source file:</strong> {fileName ?? "Not uploaded yet"}
            </li>
          </ul>
        </section>
      ) : null}

      {step === 5 ? (
        <section className="space-y-3">
          <p className="type-small">
            Continue to publish this title and make it available in BookFlow.
          </p>
          {bookId ? (
            <Link
              href={`/publisher/books/${bookId}`}
              className="type-small font-medium underline-offset-4 hover:underline"
            >
              Preview book page
            </Link>
          ) : null}
        </section>
      ) : null}

      <div className="flex justify-between border-t border-neutral-100 pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0 || pending}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Back
        </Button>
        <Button type="button" disabled={pending} onClick={goNext}>
          {pending ? "Working…" : isLast ? "Publish" : "Next"}
        </Button>
      </div>
    </div>
  );
}
