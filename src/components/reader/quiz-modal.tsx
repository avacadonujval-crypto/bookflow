"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { StudyQuiz } from "@/lib/ai/study-types";

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/^[a-d]\)\s*/i, "");
}

export function QuizModal({
  open,
  onClose,
  quiz,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  quiz: StudyQuiz | null;
  loading?: boolean;
}) {
  const questions = quiz?.questions ?? [];
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (open) {
      setIndex(0);
      setAnswers({});
      setRevealed({});
      setFinished(false);
    }
  }, [open, quiz]);

  const current = questions[index];
  const score = useMemo(() => {
    let correct = 0;
    for (const q of questions) {
      const given = answers[q.id];
      if (!given) continue;
      if (normalize(given) === normalize(q.answer)) correct += 1;
    }
    return correct;
  }, [answers, questions]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={quiz?.title || "Practice quiz"}
      subtitle="Questions and answers come from this PDF"
      size="lg"
    >
      <div className="space-y-5 px-5 py-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">Creating practice quiz with Gemini…</p>
        ) : !current ? (
          <p className="text-sm text-muted-foreground">No quiz questions yet.</p>
        ) : finished ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-center">
            <p className="text-sm font-medium text-muted-foreground">Your score</p>
            <p className="stat-value mt-2">
              {score} / {questions.length}
            </p>
            <Button
              type="button"
              className="mt-5"
              onClick={() => {
                setFinished(false);
                setIndex(0);
                setAnswers({});
                setRevealed({});
              }}
            >
              Retake quiz
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <Badge className="bg-neutral-100 text-foreground">
                Question {index + 1} of {questions.length}
              </Badge>
              <span className="text-xs uppercase tracking-wide text-neutral-400">
                {current.type.replace("_", " ")}
              </span>
            </div>

            <p className="text-base font-medium leading-relaxed text-foreground">
              {current.prompt}
            </p>

            {current.type === "short" ? (
              <Textarea
                value={answers[current.id] ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [current.id]: e.target.value }))
                }
                placeholder="Type your answer…"
                rows={3}
              />
            ) : (
              <div className="grid gap-2">
                {(current.options ?? (current.type === "true_false" ? ["True", "False"] : [])).map(
                  (option) => {
                    const selected = answers[current.id] === option;
                    const show = revealed[current.id];
                    const isCorrect =
                      normalize(option) === normalize(current.answer);
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, [current.id]: option }))
                        }
                        className={cn(
                          "rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                          selected
                            ? "border-black bg-neutral-100 text-foreground"
                            : "border-neutral-200 bg-white hover:border-neutral-300",
                          show && isCorrect && "border-black bg-neutral-100",
                          show && selected && !isCorrect && "border-neutral-400 bg-neutral-100",
                        )}
                      >
                        {option}
                      </button>
                    );
                  },
                )}
              </div>
            )}

            {revealed[current.id] ? (
              <div className="rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm text-foreground">
                <p>
                  <span className="font-semibold">Answer:</span> {current.answer}
                </p>
                {current.explanation ? (
                  <p className="mt-1 text-foreground/90">{current.explanation}</p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!answers[current.id]}
                onClick={() =>
                  setRevealed((prev) => ({ ...prev, [current.id]: true }))
                }
              >
                Check answer
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={index <= 0}
                onClick={() => setIndex((i) => i - 1)}
              >
                Previous
              </Button>
              {index < questions.length - 1 ? (
                <Button
                  type="button"
                  onClick={() => setIndex((i) => i + 1)}
                  disabled={!answers[current.id]}
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => setFinished(true)}
                  disabled={!answers[current.id]}
                >
                  Finish
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
