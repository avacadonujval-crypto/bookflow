"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  FileText,
  Highlighter,
  Loader2,
  NotebookPen,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import type { QuestionType } from "@prisma/client";
import { cn, formatPercent } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ReaderAIPanel } from "@/components/reader/reader-ai-panel";
import { AudioOverviewBar } from "@/components/reader/audio-overview-bar";
import { PdfViewerBoundary } from "@/components/reader/pdf-viewer-boundary";

/** react-pdf touches `window` at import time — never SSR it. */
const PdfViewer = dynamic(
  () =>
    import("@/components/reader/pdf-viewer").then((m) => m.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[50vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading PDF viewer…
      </div>
    ),
  },
);
import type { AnswerPayload } from "@/lib/services/quiz";
import {
  addBookmark,
  addHighlight,
  addNote,
  deleteBookmark,
  deleteHighlight,
  deleteNote,
  saveReadingProgress,
  submitChapterQuiz,
  trackReaderEvent,
  updateNote,
} from "@/lib/actions/reader";

export type ReaderChapter = {
  id: string;
  title: string;
  order: number;
  content: string;
};

export type ReaderQuestionOption = {
  id: string;
  label: string;
  order: number;
};

export type ReaderQuestion = {
  id: string;
  chapterId: string;
  type: QuestionType;
  prompt: string;
  explanation: string;
  feedback: string;
  points: number;
  order: number;
  correctText: string | null;
  matchingJson: Record<string, string> | null;
  options: ReaderQuestionOption[];
};

export type ReaderBookmark = {
  id: string;
  chapterId: string;
  label: string;
  location: string;
  createdAt: string;
};

export type ReaderHighlight = {
  id: string;
  chapterId: string;
  text: string;
  color: string;
  createdAt: string;
};

export type ReaderNote = {
  id: string;
  chapterId: string;
  body: string;
  updatedAt: string;
};

export type EbookReaderProps = {
  bookId: string;
  bookTitle: string;
  homeHref: string;
  fileUrl?: string | null;
  fileType?: string | null;
  chapters: ReaderChapter[];
  questions: ReaderQuestion[];
  initialChapterId?: string | null;
  initialPercent: number;
  bookmarks: ReaderBookmark[];
  highlights: ReaderHighlight[];
  notes: ReaderNote[];
};

type SidePanel = "none" | "bookmarks" | "highlights" | "notes";
type ContentMode = "pdf" | "chapters";

export function EbookReader({
  bookId,
  bookTitle,
  homeHref,
  fileUrl,
  fileType,
  chapters,
  questions,
  initialChapterId,
  initialPercent,
  bookmarks: initialBookmarks,
  highlights: initialHighlights,
  notes: initialNotes,
}: EbookReaderProps) {
  const hasPdf = Boolean(
    fileUrl &&
      (fileType === "pdf" ||
        fileUrl.toLowerCase().endsWith(".pdf") ||
        fileUrl.includes("blob.vercel-storage.com")) &&
      (fileUrl.startsWith("/api/files/") ||
        fileUrl.startsWith("/sample/") ||
        fileUrl.startsWith("http://") ||
        fileUrl.startsWith("https://")),
  );
  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.order - b.order),
    [chapters],
  );

  const initialIndex = useMemo(() => {
    if (!initialChapterId) return 0;
    const idx = sortedChapters.findIndex((c) => c.id === initialChapterId);
    return idx >= 0 ? idx : 0;
  }, [initialChapterId, sortedChapters]);

  const [chapterIndex, setChapterIndex] = useState(initialIndex);
  const [percentComplete, setPercentComplete] = useState(initialPercent);
  const [fontSize, setFontSize] = useState(16);
  const [contentMode, setContentMode] = useState<ContentMode>(
    hasPdf ? "pdf" : "chapters",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [sidePanel, setSidePanel] = useState<SidePanel>("none");
  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  const [highlights, setHighlights] = useState(initialHighlights);
  const [notes, setNotes] = useState(initialNotes);
  const [newNote, setNewNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteBody, setEditingNoteBody] = useState("");
  const [highlightText, setHighlightText] = useState("");
  const [quizAnswers, setQuizAnswers] = useState<Record<string, AnswerPayload>>(
    {},
  );
  const [quizResult, setQuizResult] = useState<{
    score: number;
    maxScore: number;
  } | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const currentChapter = sortedChapters[chapterIndex];
  const chapterQuestions = useMemo(
    () =>
      questions
        .filter((q) => q.chapterId === currentChapter?.id)
        .sort((a, b) => a.order - b.order),
    [questions, currentChapter?.id],
  );

  const chapterHighlights = highlights.filter(
    (h) => h.chapterId === currentChapter?.id,
  );
  const chapterNotes = notes.filter((n) => n.chapterId === currentChapter?.id);

  const displayedContent = useMemo(() => {
    if (!currentChapter) return "";
    const q = searchQuery.trim().toLowerCase();
    if (!q) return currentChapter.content;
    const plain = currentChapter.content.replace(/<[^>]+>/g, " ");
    if (!plain.toLowerCase().includes(q)) return currentChapter.content;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return currentChapter.content.replace(
      new RegExp(`(${escaped})`, "gi"),
      "<mark class=\"bg-yellow-200\">$1</mark>",
    );
  }, [currentChapter, searchQuery]);

  const persistProgress = useCallback(
    (index: number) => {
      const pct =
        sortedChapters.length <= 1
          ? 100
          : Math.round((index / (sortedChapters.length - 1)) * 100);
      setPercentComplete(pct);
      const ch = sortedChapters[index];
      if (!ch) return;
      startTransition(async () => {
        await saveReadingProgress({
          bookId,
          chapterId: ch.id,
          percentComplete: pct,
          readingTimeSecDelta: 30,
        });
      });
    },
    [bookId, sortedChapters],
  );

  const goToChapter = useCallback(
    (index: number) => {
      if (index < 0 || index >= sortedChapters.length) return;
      setChapterIndex(index);
      setQuizAnswers({});
      setQuizResult(null);
      persistProgress(index);
    },
    [persistProgress, sortedChapters.length],
  );

  const goPrev = useCallback(() => goToChapter(chapterIndex - 1), [
    chapterIndex,
    goToChapter,
  ]);
  const goNext = useCallback(() => {
    const next = chapterIndex + 1;
    if (next >= sortedChapters.length) {
      void trackReaderEvent({
        bookId,
        type: "chapter_complete",
        metadata: {
          chapterId: currentChapter?.id,
          chapterTitle: currentChapter?.title,
        },
      });
      return;
    }
    void trackReaderEvent({
      bookId,
      type: "chapter_complete",
      metadata: {
        chapterId: currentChapter?.id,
        chapterTitle: currentChapter?.title,
      },
    });
    goToChapter(next);
  }, [bookId, chapterIndex, currentChapter, goToChapter, sortedChapters.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft" || e.key === "j") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "ArrowRight" || e.key === "k") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  const runSearch = () => {
    if (!searchQuery.trim()) return;
    void trackReaderEvent({
      bookId,
      type: "search",
      metadata: { query: searchQuery.trim() },
    });
  };

  const handleAddBookmark = () => {
    if (!currentChapter) {
      setActionMessage("Open Activities and select a chapter first.");
      return;
    }
    const label =
      window.getSelection()?.toString().slice(0, 80) ||
      currentChapter.title;
    setActionMessage(null);
    startTransition(async () => {
      const res = await addBookmark({
        bookId,
        chapterId: currentChapter.id,
        label,
        location: `chapter-${currentChapter.order}`,
      });
      if (res.ok && res.data) {
        setBookmarks((prev) => [
          ...prev,
          {
            ...(res.data as ReaderBookmark),
            createdAt: new Date().toISOString(),
          },
        ]);
        setSidePanel("bookmarks");
        setActionMessage("Bookmark saved.");
      } else {
        setActionMessage(res.message ?? "Could not save bookmark.");
      }
    });
  };

  const handleAddHighlight = () => {
    const text =
      highlightText.trim() ||
      window.getSelection()?.toString().trim() ||
      "";
    if (!currentChapter) {
      setActionMessage("Open Activities and select a chapter first.");
      return;
    }
    if (!text) {
      setActionMessage("Enter text to highlight, then click Add highlight.");
      setSidePanel("highlights");
      return;
    }
    setActionMessage(null);
    startTransition(async () => {
      const res = await addHighlight({
        bookId,
        chapterId: currentChapter.id,
        text,
      });
      if (res.ok && res.data) {
        setHighlights((prev) => [
          ...prev,
          {
            ...(res.data as ReaderHighlight),
            createdAt: new Date().toISOString(),
          },
        ]);
        setHighlightText("");
        setSidePanel("highlights");
        setActionMessage("Highlight saved.");
      } else {
        setActionMessage(res.message ?? "Could not save highlight.");
      }
    });
  };

  const handleAddNote = () => {
    if (!currentChapter) {
      setActionMessage("Open Activities and select a chapter first.");
      return;
    }
    if (!newNote.trim()) {
      setActionMessage("Type a note first.");
      setSidePanel("notes");
      return;
    }
    setActionMessage(null);
    startTransition(async () => {
      const res = await addNote({
        bookId,
        chapterId: currentChapter.id,
        body: newNote.trim(),
      });
      if (res.ok && res.data) {
        const n = res.data as ReaderNote;
        setNotes((prev) => [
          ...prev,
          { ...n, updatedAt: new Date().toISOString() },
        ]);
        setNewNote("");
        setSidePanel("notes");
        setActionMessage("Note saved.");
      } else {
        setActionMessage(res.message ?? "Could not save note.");
      }
    });
  };

  const handleSubmitQuiz = () => {
    if (!currentChapter) return;
    setQuizError(null);
    startTransition(async () => {
      const res = await submitChapterQuiz({
        bookId,
        chapterId: currentChapter.id,
        answers: quizAnswers,
      });
      if (res.ok && res.data) {
        const d = res.data as { score: number; maxScore: number };
        setQuizResult({ score: d.score, maxScore: d.maxScore });
        setQuizError(null);
      } else {
        setQuizResult(null);
        setQuizError(res.message ?? "Could not submit quiz. Answer all questions and try again.");
      }
    });
  };

  const setMcAnswer = (questionId: string, optionId: string) => {
    setQuizAnswers((prev) => ({
      ...prev,
      [questionId]: { type: "MULTIPLE_CHOICE", optionId },
    }));
  };

  const setTrueFalseAnswer = (
    questionId: string,
    optionLabel: string,
  ) => {
    setQuizAnswers((prev) => ({
      ...prev,
      [questionId]: {
        type: "TRUE_FALSE",
        value: optionLabel.trim().toLowerCase() === "true",
      },
    }));
  };

  const toggleMultiAnswer = (questionId: string, optionId: string) => {
    setQuizAnswers((prev) => {
      const existing = prev[questionId];
      const ids =
        existing?.type === "MULTIPLE_ANSWER" ? [...existing.optionIds] : [];
      const idx = ids.indexOf(optionId);
      if (idx >= 0) ids.splice(idx, 1);
      else ids.push(optionId);
      return {
        ...prev,
        [questionId]: { type: "MULTIPLE_ANSWER", optionIds: ids },
      };
    });
  };

  if (!currentChapter && !hasPdf) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        This book has no chapters or PDF file yet.
      </div>
    );
  }

  const showingPdf = hasPdf && contentMode === "pdf" && !!fileUrl;
  const chapterLabel = showingPdf
    ? `Reading PDF · ${formatPercent(percentComplete, 0)} complete`
    : currentChapter
      ? `${currentChapter.title} · ${formatPercent(percentComplete, 0)} complete`
      : `${formatPercent(percentComplete, 0)} complete`;

  const openSideFromTools = (panel: SidePanel) => {
    setToolsOpen(false);
    setSidePanel(panel);
  };

  return (
    <div className="flex h-[100dvh] min-h-screen flex-col overflow-hidden bg-white text-foreground">
      <header className="sticky top-0 z-20 shrink-0 border-b border-neutral-200/80 bg-white/95 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Link
            href={homeHref}
            className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/80"
          >
            BookFlow
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[14px] font-semibold tracking-tight">
              {bookTitle}
            </h1>
            <p className="truncate text-[11px] text-muted-foreground">
              {chapterLabel}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setToolsOpen(true)}
              data-testid="reader-tools-open"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Tools
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setAiOpen(true)}
              data-testid="reader-ai-open"
            >
              <Sparkles className="h-4 w-4" />
              AI Tutor
            </Button>
          </div>
        </div>
        <div data-testid="reading-progress">
          <Progress value={percentComplete} className="h-0.5 rounded-none" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            showingPdf ? "overflow-hidden" : "overflow-y-auto",
          )}
        >
          {actionMessage ? (
            <p
              className="mx-3 mt-3 shrink-0 rounded-[1rem] border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 lg:mx-4"
              role="status"
              data-testid="action-message"
            >
              {actionMessage}
            </p>
          ) : null}

          <div
            className={cn(
              showingPdf
                ? "flex min-h-0 flex-1 flex-col p-0"
                : "px-3 py-4 lg:px-5",
            )}
          >
          {showingPdf ? (
            <div data-testid="reader-chapter" className="flex min-h-0 flex-1 flex-col">
              <PdfViewerBoundary fileUrl={fileUrl!}>
                <PdfViewer
                  fileUrl={fileUrl!}
                  className="min-h-[calc(100dvh-7rem)]"
                />
              </PdfViewerBoundary>
            </div>
          ) : currentChapter ? (
            <article
              className="prose prose-slate max-w-none leading-relaxed [&_mark]:rounded-sm"
              style={{ fontSize: `${fontSize}px` }}
              data-testid="reader-chapter"
              dangerouslySetInnerHTML={{ __html: displayedContent }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No chapter text yet. Switch to PDF to read the uploaded file.
            </p>
          )}

          {currentChapter && chapterQuestions.length > 0 ? (
            <section
              className="mt-10 rounded-xl border border-black/10 p-5"
              aria-label="Chapter activities"
            >
              <h2 className="text-lg font-semibold">Chapter check-in</h2>
              <p className="mt-1 text-sm opacity-70">
                Answer the questions below to practice what you read.
              </p>
              <div className="mt-6 space-y-8">
                {chapterQuestions.map((q) => (
                  <div key={q.id} className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{q.prompt}</p>
                      <Badge className="shrink-0 bg-neutral-100 text-foreground">
                        {q.points} pt{q.points === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    {q.type === "MULTIPLE_CHOICE" ? (
                      <div className="space-y-2" role="radiogroup" aria-label={q.prompt}>
                        {q.options.map((opt) => (
                          <label
                            key={opt.id}
                            className="flex cursor-pointer items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm"
                          >
                            <input
                              type="radio"
                              name={`q-${q.id}`}
                              aria-label={opt.label}
                              checked={(() => {
                                const ans = quizAnswers[q.id];
                                return (
                                  ans?.type === "MULTIPLE_CHOICE" &&
                                  ans.optionId === opt.id
                                );
                              })()}
                              onChange={() => setMcAnswer(q.id, opt.id)}
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    ) : null}
                    {q.type === "TRUE_FALSE" ? (
                      <div className="space-y-2" role="radiogroup" aria-label={q.prompt}>
                        {q.options.map((opt) => {
                          const ans = quizAnswers[q.id];
                          const selected =
                            ans?.type === "TRUE_FALSE" &&
                            ans.value ===
                              (opt.label.trim().toLowerCase() === "true");
                          return (
                            <label
                              key={opt.id}
                              className="flex cursor-pointer items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm"
                            >
                              <input
                                type="radio"
                                name={`q-${q.id}`}
                                aria-label={opt.label}
                                checked={!!selected}
                                onChange={() =>
                                  setTrueFalseAnswer(q.id, opt.label)
                                }
                              />
                              {opt.label}
                            </label>
                          );
                        })}
                      </div>
                    ) : null}
                    {q.type === "MULTIPLE_ANSWER" ? (
                      <div className="space-y-2">
                        {q.options.map((opt) => {
                          const ans = quizAnswers[q.id];
                          const selected =
                            ans?.type === "MULTIPLE_ANSWER" &&
                            ans.optionIds.includes(opt.id);
                          return (
                            <label
                              key={opt.id}
                              className="flex cursor-pointer items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={!!selected}
                                onChange={() => toggleMultiAnswer(q.id, opt.id)}
                              />
                              {opt.label}
                            </label>
                          );
                        })}
                      </div>
                    ) : null}
                    {q.type === "FILL_BLANK" ? (
                      <Input
                        aria-label="Fill in the blank answer"
                        placeholder="Your answer"
                        value={
                          (() => {
                            const ans = quizAnswers[q.id];
                            return ans?.type === "FILL_BLANK" ? ans.text : "";
                          })()
                        }
                        onChange={(e) =>
                          setQuizAnswers((prev) => ({
                            ...prev,
                            [q.id]: { type: "FILL_BLANK", text: e.target.value },
                          }))
                        }
                      />
                    ) : null}
                    {q.type === "REFLECTION" ? (
                      <Textarea
                        aria-label="Reflection response"
                        placeholder="Write at least a few sentences…"
                        rows={4}
                        value={
                          (() => {
                            const ans = quizAnswers[q.id];
                            return ans?.type === "REFLECTION" ? ans.text : "";
                          })()
                        }
                        onChange={(e) =>
                          setQuizAnswers((prev) => ({
                            ...prev,
                            [q.id]: { type: "REFLECTION", text: e.target.value },
                          }))
                        }
                      />
                    ) : null}
                    {q.type === "MATCHING" && q.matchingJson ? (
                      <div className="space-y-3">
                        {Object.keys(q.matchingJson).map((left) => (
                          <div key={left} className="flex flex-col gap-1 sm:flex-row sm:items-center">
                            <span className="min-w-32 text-sm font-medium">{left}</span>
                            <Input
                              aria-label={`Match for ${left}`}
                              placeholder="Match…"
                              value={(() => {
                                const ans = quizAnswers[q.id];
                                return ans?.type === "MATCHING"
                                  ? ans.pairs[left] ?? ""
                                  : "";
                              })()}
                              onChange={(e) =>
                                setQuizAnswers((prev) => {
                                  const cur = prev[q.id];
                                  const existing =
                                    cur?.type === "MATCHING"
                                      ? { ...cur.pairs }
                                      : {};
                                  return {
                                    ...prev,
                                    [q.id]: {
                                      type: "MATCHING",
                                      pairs: { ...existing, [left]: e.target.value },
                                    },
                                  };
                                })
                              }
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={handleSubmitQuiz}
                  disabled={pending}
                  aria-label="Submit chapter quiz"
                  data-testid="quiz-submit"
                >
                  {pending ? "Submitting…" : "Submit answers"}
                </Button>
                {quizResult ? (
                  <p
                    className="text-sm font-medium text-foreground"
                    data-testid="quiz-score"
                  >
                    Score: {quizResult.score} / {quizResult.maxScore}
                  </p>
                ) : null}
                {quizError ? (
                  <p className="text-sm text-foreground" role="alert" data-testid="quiz-error">
                    {quizError}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          {!showingPdf && currentChapter ? (
            <footer className="mt-10 flex items-center justify-between gap-4 border-t border-black/10 pt-6">
              <Button
                type="button"
                variant="outline"
                aria-label="Previous chapter"
                onClick={goPrev}
                disabled={chapterIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-xs opacity-60">
                Chapter {currentChapter.order} of {sortedChapters.length}
              </span>
              <Button
                type="button"
                variant="outline"
                aria-label="Next chapter"
                onClick={goNext}
                disabled={chapterIndex >= sortedChapters.length - 1}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </footer>
          ) : null}
          </div>
        </main>

        {sidePanel !== "none" ? (
          <aside
            className="w-full border-t border-black/10 p-4 lg:w-72 lg:border-l lg:border-t-0"
            aria-label={
              sidePanel === "bookmarks"
                ? "Bookmarks"
                : sidePanel === "highlights"
                  ? "Highlights"
                  : "Notes"
            }
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold capitalize">{sidePanel}</h2>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label="Close panel"
                onClick={() => setSidePanel("none")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {sidePanel === "bookmarks" ? (
              <ul className="space-y-2 text-sm">
                {bookmarks.length === 0 ? (
                  <li className="opacity-60">No bookmarks yet.</li>
                ) : (
                  bookmarks.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-black/10 p-2"
                    >
                      <button
                        type="button"
                        className="text-left hover:underline"
                        onClick={() => {
                          const idx = sortedChapters.findIndex(
                            (c) => c.id === b.chapterId,
                          );
                          if (idx >= 0) goToChapter(idx);
                        }}
                      >
                        {b.label || "Bookmark"}
                      </button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label="Delete bookmark"
                        onClick={() =>
                          startTransition(async () => {
                            const res = await deleteBookmark(b.id);
                            if (res.ok) {
                              setBookmarks((prev) =>
                                prev.filter((x) => x.id !== b.id),
                              );
                            }
                          })
                        }
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}

            {sidePanel === "highlights" ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={highlightText}
                    onChange={(e) => setHighlightText(e.target.value)}
                    placeholder="Text to highlight…"
                    aria-label="Highlight text"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddHighlight}
                    disabled={pending}
                    aria-label="Save highlight"
                  >
                    Add
                  </Button>
                </div>
                <ul className="space-y-2 text-sm">
                  {chapterHighlights.length === 0 ? (
                    <li className="opacity-60">No highlights in this chapter.</li>
                  ) : (
                    chapterHighlights.map((h) => (
                      <li
                        key={h.id}
                        className="rounded-lg border border-yellow-200/80 bg-yellow-50/50 p-2 dark:bg-yellow-900/20"
                      >
                        <p>{h.text}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="mt-1"
                          aria-label="Delete highlight"
                          onClick={() =>
                            startTransition(async () => {
                              const res = await deleteHighlight(h.id);
                              if (res.ok) {
                                setHighlights((prev) =>
                                  prev.filter((x) => x.id !== h.id),
                                );
                              }
                            })
                          }
                        >
                          Remove
                        </Button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ) : null}

            {sidePanel === "notes" ? (
              <div className="space-y-3">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note for this chapter…"
                  aria-label="New note"
                  rows={3}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddNote}
                  disabled={pending}
                  aria-label="Save note"
                >
                  Save note
                </Button>
                <ul className="space-y-2 text-sm">
                  {chapterNotes.map((n) => (
                    <li
                      key={n.id}
                      className="rounded-lg border border-black/10 p-2"
                    >
                      {editingNoteId === n.id ? (
                        <>
                          <Textarea
                            value={editingNoteBody}
                            onChange={(e) => setEditingNoteBody(e.target.value)}
                            aria-label="Edit note"
                            rows={3}
                          />
                          <div className="mt-2 flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() =>
                                startTransition(async () => {
                                  const res = await updateNote({
                                    noteId: n.id,
                                    body: editingNoteBody,
                                  });
                                  if (res.ok) {
                                    setNotes((prev) =>
                                      prev.map((x) =>
                                        x.id === n.id
                                          ? { ...x, body: editingNoteBody }
                                          : x,
                                      ),
                                    );
                                    setEditingNoteId(null);
                                  }
                                })
                              }
                            >
                              Update
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingNoteId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap">{n.body}</p>
                          <div className="mt-2 flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingNoteId(n.id);
                                setEditingNoteBody(n.body);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              aria-label="Delete note"
                              onClick={() =>
                                startTransition(async () => {
                                  const res = await deleteNote(n.id);
                                  if (res.ok) {
                                    setNotes((prev) =>
                                      prev.filter((x) => x.id !== n.id),
                                    );
                                  }
                                })
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        ) : null}

      </div>

      <Modal
        open={toolsOpen}
        onClose={() => setToolsOpen(false)}
        title="Reading tools"
        subtitle="Keep the page clear — open tools only when you need them"
        size="md"
      >
        <div className="space-y-5 px-5 py-5">
          {hasPdf ? (
            <section className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                View
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={showingPdf ? "default" : "outline"}
                  onClick={() => {
                    setContentMode("pdf");
                    setToolsOpen(false);
                  }}
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
                <Button
                  type="button"
                  variant={!showingPdf ? "default" : "outline"}
                  disabled={!currentChapter}
                  onClick={() => {
                    setContentMode("chapters");
                    setToolsOpen(false);
                  }}
                >
                  Activities
                </Button>
              </div>
            </section>
          ) : null}

          {!showingPdf ? (
            <section className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                Text size
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setFontSize((s) => Math.max(12, s - 2))}
                >
                  A−
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setFontSize((s) => Math.min(24, s + 2))}
                >
                  A+
                </Button>
              </div>
            </section>
          ) : null}

          {!showingPdf ? (
            <section className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                Search
              </p>
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search within this book…"
                  aria-label="Search within book"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      runSearch();
                      setToolsOpen(false);
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    runSearch();
                    setToolsOpen(false);
                  }}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </section>
          ) : null}

          <section className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
              Notes & marks
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending || !currentChapter}
                onClick={() => {
                  setToolsOpen(false);
                  handleAddBookmark();
                }}
              >
                <Bookmark className="h-4 w-4" />
                Bookmark
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => openSideFromTools("highlights")}
              >
                <Highlighter className="h-4 w-4" />
                Highlights
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => openSideFromTools("notes")}
              >
                <NotebookPen className="h-4 w-4" />
                Notes
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => openSideFromTools("bookmarks")}
              >
                <FileText className="h-4 w-4" />
                Saved
              </Button>
            </div>
          </section>
        </div>
      </Modal>

      <Modal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        title="AI Tutor"
        subtitle="Audio Overview, Live Tutor, chat, and practice"
        size="xl"
        className="h-[min(90vh,860px)]"
      >
        <div className="h-full min-h-[520px] overflow-hidden">
          <ReaderAIPanel
            bookId={bookId}
            bookTitle={bookTitle}
            chapterId={currentChapter?.id ?? null}
          />
        </div>
      </Modal>

      <AudioOverviewBar bookId={bookId} />
    </div>
  );
}
