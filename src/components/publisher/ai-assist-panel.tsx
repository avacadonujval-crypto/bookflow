"use client";

import { useActionState } from "react";
import type { AIGenerationStatus, AIGenerationType } from "@prisma/client";
import {
  generateAIContent,
  updateAIRequestStatus,
  type AIActionState,
} from "@/lib/actions/ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

type BookOption = { id: string; title: string };
type ChapterOption = { id: string; bookId: string; title: string; order: number };

export type AIRequestRow = {
  id: string;
  type: AIGenerationType;
  status: AIGenerationStatus;
  prompt: string;
  result: string;
  createdAt: string;
  bookTitle: string | null;
};

const initialState: AIActionState = { ok: false };

const featureTabs = [
  { id: "chapter_summary", label: "Chapter summary" },
  { id: "flashcards", label: "Flashcards" },
  { id: "practice_questions", label: "Practice questions" },
  { id: "ask_book", label: "Ask book" },
  { id: "next_chapter", label: "Next chapter" },
  { id: "reading_level", label: "Reading level" },
] as const;

type FeatureId = (typeof featureTabs)[number]["id"];

function statusBadgeClass(status: AIGenerationStatus) {
  switch (status) {
    case "PUBLISHED":
      return "bg-neutral-100 text-foreground";
    case "REVIEWED":
      return "bg-neutral-100 text-foreground";
    case "REJECTED":
      return "bg-neutral-100 text-foreground";
    case "COMPLETED":
      return "bg-neutral-100 text-muted-foreground";
    default:
      return "bg-neutral-100 text-neutral-700";
  }
}

export function AIAssistPanel({
  books,
  chapters,
  requests,
}: {
  books: BookOption[];
  chapters: ChapterOption[];
  requests: AIRequestRow[];
}) {
  const [genState, generateAction, genPending] = useActionState(
    generateAIContent,
    initialState,
  );
  const [, reviewAction, reviewPending] = useActionState(
    updateAIRequestStatus,
    initialState,
  );

  const defaultBookId = books[0]?.id ?? "";

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-3 text-sm text-foreground">
        <strong>AI-generated — review required.</strong> All outputs are drafts.
        Approve only after verifying accuracy against source material.
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {featureTabs.map((tab) => (
          <Card key={tab.id}>
            <CardHeader>
              <CardTitle className="text-base">{tab.label}</CardTitle>
              <CardDescription>
                Generate {tab.label.toLowerCase()} using the mock AI provider.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={generateAction} className="space-y-3">
                <input type="hidden" name="feature" value={tab.id} />
                <div className="space-y-2">
                  <Label htmlFor={`${tab.id}-book`}>Book</Label>
                  <select
                    id={`${tab.id}-book`}
                    name="bookId"
                    required
                    defaultValue={defaultBookId}
                    className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"
                  >
                    {books.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                      </option>
                    ))}
                  </select>
                </div>

                {needsChapter(tab.id) ? (
                  <ChapterSelect
                    featureId={tab.id}
                    chapters={chapters}
                    defaultBookId={defaultBookId}
                  />
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor={`${tab.id}-chapter`}>Chapter (optional)</Label>
                    <select
                      id={`${tab.id}-chapter`}
                      name="chapterId"
                      className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"
                      defaultValue=""
                    >
                      <option value="">—</option>
                      {chapters
                        .filter((c) => c.bookId === defaultBookId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.order}. {c.title}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {tab.id === "ask_book" ? (
                  <div className="space-y-2">
                    <Label htmlFor={`${tab.id}-question`}>Question</Label>
                    <Textarea
                      id={`${tab.id}-question`}
                      name="question"
                      rows={3}
                      placeholder="What should the AI answer about this book?"
                      required
                    />
                  </div>
                ) : null}

                {tab.id === "reading_level" ? (
                  <div className="space-y-2">
                    <Label htmlFor={`${tab.id}-level`}>Target level</Label>
                    <Input
                      id={`${tab.id}-level`}
                      name="targetLevel"
                      placeholder="e.g. simpler, grade 6, advanced"
                      defaultValue="simpler"
                    />
                  </div>
                ) : null}

                <Button type="submit" size="sm" disabled={genPending || !books.length}>
                  Generate
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>

      {genState.message ? (
        <p
          className={`text-sm ${genState.ok ? "text-foreground" : "text-foreground"}`}
          role="status"
        >
          {genState.message}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent AI requests</CardTitle>
          <CardDescription>Review, reject, or approve generated content.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No AI requests yet.</p>
          ) : (
            requests.map((req) => (
              <article
                key={req.id}
                className="rounded-lg border border-neutral-100 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">
                      {req.type.replace(/_/g, " ")}
                      {req.bookTitle ? ` · ${req.bookTitle}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(req.createdAt)} · {req.prompt || "—"}
                    </p>
                  </div>
                  <Badge className={statusBadgeClass(req.status)}>{req.status}</Badge>
                </div>
                <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-neutral-50 p-3 text-xs text-neutral-700">
                  {req.result || "—"}
                </pre>
                <p className="mt-2 text-xs text-muted-foreground">
                  AI-generated — review required
                </p>
                {req.status === "COMPLETED" || req.status === "REVIEWED" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={reviewAction}>
                      <input type="hidden" name="requestId" value={req.id} />
                      <input type="hidden" name="status" value="REVIEWED" />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={reviewPending || req.status === "REVIEWED"}
                      >
                        Review
                      </Button>
                    </form>
                    <form action={reviewAction}>
                      <input type="hidden" name="requestId" value={req.id} />
                      <input type="hidden" name="status" value="REJECTED" />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={reviewPending}
                      >
                        Reject
                      </Button>
                    </form>
                    <form action={reviewAction}>
                      <input type="hidden" name="requestId" value={req.id} />
                      <input type="hidden" name="status" value="PUBLISHED" />
                      <Button type="submit" size="sm" disabled={reviewPending}>
                        Approve
                      </Button>
                    </form>
                  </div>
                ) : null}
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function needsChapter(feature: FeatureId) {
  return (
    feature === "chapter_summary" ||
    feature === "flashcards" ||
    feature === "practice_questions" ||
    feature === "next_chapter" ||
    feature === "reading_level"
  );
}

function ChapterSelect({
  featureId,
  chapters,
  defaultBookId,
}: {
  featureId: string;
  chapters: ChapterOption[];
  defaultBookId: string;
}) {
  const filtered = chapters.filter((c) => c.bookId === defaultBookId);
  return (
    <div className="space-y-2">
      <Label htmlFor={`${featureId}-chapter-req`}>Chapter</Label>
      <select
        id={`${featureId}-chapter-req`}
        name="chapterId"
        required
        className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"
        defaultValue={filtered[0]?.id ?? ""}
      >
        {filtered.map((c) => (
          <option key={c.id} value={c.id}>
            {c.order}. {c.title}
          </option>
        ))}
      </select>
    </div>
  );
}
