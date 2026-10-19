"use client";

import { useState, useTransition } from "react";
import {
  Loader2,
  MessageCircle,
  Layers,
  ClipboardList,
  Radio,
  BookOpenCheck,
  ListChecks,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { runReaderAI } from "@/lib/actions/reader-ai";
import type { AIFeature } from "@/lib/ai";
import type { StudyFlashcardDeck, StudyQuiz } from "@/lib/ai/study-types";
import { TutorChatModal } from "@/components/reader/tutor-chat-modal";
import { LiveTutorModal } from "@/components/reader/live-tutor-modal";
import { AudioOverviewPlayer } from "@/components/reader/audio-overview-player";
import { FlashcardsModal } from "@/components/reader/flashcards-modal";
import { QuizModal } from "@/components/reader/quiz-modal";
import { cn } from "@/lib/utils";

const MORE_TOOLS: {
  id: AIFeature;
  label: string;
}[] = [
  { id: "teach_book", label: "Teach whole PDF" },
  { id: "study_guide", label: "Study guide" },
  { id: "explain", label: "Explain simply" },
  { id: "chapter_summary", label: "Summarize" },
  { id: "next_chapter", label: "What's next" },
  { id: "reading_level", label: "Easier words" },
];

export function ReaderAIPanel({
  bookId,
  bookTitle,
}: {
  bookId: string;
  bookTitle?: string;
  /** @deprecated Ignored — AI uses the PDF only. */
  chapterId?: string | null;
}) {
  const [question, setQuestion] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatPrompt, setChatPrompt] = useState<string | null>(null);
  const [liveOpen, setLiveOpen] = useState(false);

  const [flashOpen, setFlashOpen] = useState(false);
  const [flashLoading, setFlashLoading] = useState(false);
  const [flashDeck, setFlashDeck] = useState<StudyFlashcardDeck | null>(null);

  const [quizOpen, setQuizOpen] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quiz, setQuiz] = useState<StudyQuiz | null>(null);

  const openChat = (prompt?: string) => {
    setChatPrompt(prompt?.trim() || null);
    setChatOpen(true);
  };

  const createFlashcards = (topic?: string) => {
    setError(null);
    setFlashOpen(true);
    setFlashLoading(true);
    setFlashDeck(null);

    startTransition(async () => {
      const res = await runReaderAI({
        feature: "flashcards",
        bookId,
        question:
          topic?.trim() ||
          question.trim() ||
          "Create flashcards for the key ideas in this PDF",
      });
      setFlashLoading(false);
      if (!res.ok || !res.flashcards) {
        setError(res.message ?? "Could not create flashcards");
        return;
      }
      setFlashDeck(res.flashcards);
    });
  };

  const createQuiz = (topic?: string) => {
    setError(null);
    setQuizOpen(true);
    setQuizLoading(true);
    setQuiz(null);

    startTransition(async () => {
      const res = await runReaderAI({
        feature: "practice_questions",
        bookId,
        question:
          topic?.trim() ||
          question.trim() ||
          "Create a practice quiz from this PDF",
      });
      setQuizLoading(false);
      if (!res.ok || !res.quiz) {
        setError(res.message ?? "Could not create practice quiz");
        return;
      }
      setQuiz(res.quiz);
    });
  };

  const runTextTool = (feature: AIFeature, promptOverride?: string) => {
    const prompt = (promptOverride ?? question).trim();
    if (feature === "flashcards") {
      createFlashcards(prompt);
      return;
    }
    if (feature === "practice_questions") {
      createQuiz(prompt);
      return;
    }

    const defaultPrompt =
      feature === "teach_book"
        ? "Teach me this whole PDF step by step with a full overview"
        : feature === "chapter_summary"
          ? "Give me a full overview of this PDF"
          : feature === "explain"
            ? "Explain the main ideas in this PDF"
            : feature === "ask_book"
              ? "Give me an overview of what this PDF covers"
              : prompt || feature.replace(/_/g, " ");

    openChat(prompt || defaultPrompt);
  };

  const ask = () => {
    const q = question.trim();
    const lower = q.toLowerCase();
    if (lower.includes("flashcard")) {
      createFlashcards(q);
      return;
    }
    if (lower.includes("quiz") || lower.includes("practice")) {
      createQuiz(q);
      return;
    }
    openChat(q || "Give me an overview of what this book covers");
  };

  return (
    <>
      <aside
        className="flex h-full min-h-0 w-full flex-col bg-[#fafafa]"
        aria-label="AI reading tutor"
        data-testid="reader-ai-panel"
      >
        <div className="border-b border-neutral-200/80 bg-white px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
            Study with
          </p>
          <h2 className="mt-0.5 text-[17px] font-semibold tracking-tight text-foreground">
            AI Tutor
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            Grounded in this PDF · verify important facts
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
            <AudioOverviewPlayer bookId={bookId} bookTitle={bookTitle} />

            <section className="space-y-2">
              <p className="px-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                Talk
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={() => setLiveOpen(true)}
                data-testid="ai-live-tutor"
                className="group flex w-full items-start gap-3 rounded-[1.35rem] bg-black px-4 py-3.5 text-left text-white transition hover:bg-neutral-800 disabled:opacity-40"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Radio className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold tracking-tight">
                    Live Tutor
                  </span>
                  <span className="mt-0.5 block text-[12px] font-light text-white/70">
                    Ask out loud — answers stream live
                  </span>
                </span>
              </button>

              <button
                type="button"
                disabled={pending}
                onClick={() => openChat()}
                data-testid="ai-open-chat"
                className="flex w-full items-start gap-3 rounded-[1.35rem] border border-neutral-200 bg-white px-4 py-3.5 text-left transition hover:border-neutral-400 disabled:opacity-40"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold tracking-tight">
                    Study chat
                  </span>
                  <span className="mt-0.5 block text-[12px] text-muted-foreground">
                    Text Q&A with optional audio
                  </span>
                </span>
              </button>
            </section>

            <section className="space-y-2">
              <p className="px-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                Practice
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => createFlashcards()}
                  data-testid="ai-flashcards"
                  className="flex flex-col items-start gap-2 rounded-[1.25rem] border border-neutral-200 bg-white px-3.5 py-3 text-left transition hover:border-neutral-400 disabled:opacity-40"
                >
                  {pending && flashLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Layers className="h-4 w-4" />
                  )}
                  <span className="text-[13px] font-medium">Flashcards</span>
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => createQuiz()}
                  data-testid="ai-quiz"
                  className="flex flex-col items-start gap-2 rounded-[1.25rem] border border-neutral-200 bg-white px-3.5 py-3 text-left transition hover:border-neutral-400 disabled:opacity-40"
                >
                  {pending && quizLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ClipboardList className="h-4 w-4" />
                  )}
                  <span className="text-[13px] font-medium">Quiz</span>
                </button>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  runTextTool(
                    "teach_book",
                    "Teach me this whole PDF from the beginning",
                  )
                }
                data-testid="ai-teach-book"
                className="flex w-full items-center gap-2.5 rounded-[1.25rem] border border-neutral-200 bg-white px-3.5 py-3 text-left text-[13px] font-medium transition hover:border-neutral-400 disabled:opacity-40"
              >
                <BookOpenCheck className="h-4 w-4 shrink-0" />
                Teach me the whole PDF
              </button>
            </section>

            <section>
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                className="flex w-full items-center justify-between px-0.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400"
              >
                <span className="inline-flex items-center gap-1.5">
                  <ListChecks className="h-3.5 w-3.5" />
                  More tools
                </span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    moreOpen && "rotate-180",
                  )}
                />
              </button>
              {moreOpen ? (
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {MORE_TOOLS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      disabled={pending}
                      onClick={() => runTextTool(a.id)}
                      className="rounded-[1rem] px-3 py-2 text-left text-[12px] text-neutral-700 transition hover:bg-neutral-200/60 disabled:opacity-40"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            {error ? (
              <p className="rounded-[1rem] bg-neutral-200/50 px-3 py-2 text-[13px] text-foreground" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-neutral-200/80 bg-white px-4 py-3">
            <label htmlFor="ask-book" className="sr-only">
              Ask anything about this book
            </label>
            <Textarea
              id="ask-book"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask anything about this book…"
              rows={2}
              className="min-h-[64px] resize-none border-neutral-200 bg-neutral-50 text-[13px] focus-visible:bg-white"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask();
                }
              }}
            />
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                className="flex-1"
                disabled={pending}
                onClick={ask}
              >
                Ask
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setLiveOpen(true)}
              >
                <Radio className="h-4 w-4" />
                Live
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <TutorChatModal
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        bookId={bookId}
        initialPrompt={chatPrompt}
        onOpenFlashcards={(topic) => {
          setChatOpen(false);
          createFlashcards(topic);
        }}
        onOpenQuiz={(topic) => {
          setChatOpen(false);
          createQuiz(topic);
        }}
      />

      <LiveTutorModal
        open={liveOpen}
        onClose={() => setLiveOpen(false)}
        bookId={bookId}
      />

      <FlashcardsModal
        open={flashOpen}
        onClose={() => setFlashOpen(false)}
        deck={flashDeck}
        loading={flashLoading || (pending && flashOpen && !flashDeck)}
      />

      <QuizModal
        open={quizOpen}
        onClose={() => setQuizOpen(false)}
        quiz={quiz}
        loading={quizLoading || (pending && quizOpen && !quiz)}
      />
    </>
  );
}
