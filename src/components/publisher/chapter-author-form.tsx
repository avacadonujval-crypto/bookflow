"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect } from "react";
import {
  updateChapterContent,
  type BookActionState,
} from "@/lib/actions/books";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Chapter = {
  id: string;
  title: string;
  order: number;
  content: string;
};

type QuestionSummary = {
  id: string;
  type: string;
  prompt: string;
  order: number;
};

const initial: BookActionState = { ok: false };

export function ChapterAuthorForm({
  bookId,
  chapters,
  questionsByChapter,
}: {
  bookId: string;
  chapters: Chapter[];
  questionsByChapter: Record<string, QuestionSummary[]>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramChapter = searchParams.get("chapter");
  const active =
    chapters.find((c) => c.id === paramChapter) ?? chapters[0] ?? null;

  const [state, formAction, pending] = useActionState(
    updateChapterContent,
    initial,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  if (!active) {
    return (
      <p className="text-sm text-muted-foreground">
        No chapters available. Add chapters from the upload wizard or book settings.
      </p>
    );
  }

  const questions = questionsByChapter[active.id] ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <nav className="space-y-1">
        {chapters.map((ch) => (
          <button
            key={ch.id}
            type="button"
            onClick={() =>
              router.push(
                `/publisher/books/${bookId}/author?chapter=${ch.id}`,
              )
            }
            className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
              ch.id === active.id
                ? "bg-neutral-100 font-medium text-foreground"
                : "text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {ch.order + 1}. {ch.title}
          </button>
        ))}
      </nav>

      <div className="space-y-6">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="bookId" value={bookId} />
          <input type="hidden" name="chapterId" value={active.id} />
          <div className="space-y-2">
            <Label htmlFor="content">Chapter content (HTML)</Label>
            <Textarea
              id="content"
              name="content"
              key={active.id}
              defaultValue={active.content}
              rows={16}
              className="font-mono text-xs"
            />
          </div>
          {state.message ? (
            <p
              className={`text-sm ${state.ok ? "text-foreground" : "text-foreground"}`}
            >
              {state.message}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            Save chapter
          </Button>
        </form>

        <div className="rounded-xl border border-neutral-100 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium text-foreground">Questions &amp; interactions</h3>
            <Link
              href={`/publisher/books/${bookId}/author/elements?chapter=${active.id}`}
            >
              <Button size="sm" variant="outline">
                Add interactive element
              </Button>
            </Link>
          </div>
          {questions.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No questions in this chapter yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {questions.map((q) => (
                <li
                  key={q.id}
                  className="rounded-lg bg-neutral-50 px-3 py-2 text-sm"
                >
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    {q.type.replace(/_/g, " ")}
                  </span>
                  <p className="text-foreground">{q.prompt}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
