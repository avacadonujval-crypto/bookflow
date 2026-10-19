"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StudyFlashcardDeck } from "@/lib/ai/study-types";

export function FlashcardsModal({
  open,
  onClose,
  deck,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  deck: StudyFlashcardDeck | null;
  loading?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (open) {
      setIndex(0);
      setFlipped(false);
    }
  }, [open, deck]);

  const cards = deck?.cards ?? [];
  const card = cards[index];
  const total = cards.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={deck?.title || "Flashcards"}
      subtitle="Built from this PDF · tap a card to flip"
      size="lg"
      className="bg-gradient-to-b from-slate-50 to-white"
    >
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-5 px-5 py-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Creating flashcards with Gemini…</p>
        ) : !card ? (
          <p className="text-sm text-muted-foreground">No flashcards yet.</p>
        ) : (
          <>
            <Badge className="bg-neutral-100 text-foreground">
              Card {index + 1} of {total}
            </Badge>

            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className={cn(
                "group relative h-[260px] w-full max-w-md perspective-[1200px]",
              )}
              aria-label={flipped ? "Show question" : "Show answer"}
            >
              <div
                className={cn(
                  "relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]",
                  flipped && "[transform:rotateY(180deg)]",
                )}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white px-6 py-8 text-center shadow-lg [backface-visibility:hidden]">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                    Question
                  </p>
                  <p className="text-lg font-medium leading-snug text-foreground">
                    {card.front}
                  </p>
                  <p className="mt-6 text-xs text-neutral-400">Click to reveal answer</p>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-neutral-300 bg-neutral-100 px-6 py-8 text-center shadow-lg [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-foreground/70">
                    Answer
                  </p>
                  <p className="text-base leading-relaxed text-foreground">
                    {card.back}
                  </p>
                </div>
              </div>
            </button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={index <= 0}
                onClick={() => {
                  setIndex((i) => Math.max(0, i - 1));
                  setFlipped(false);
                }}
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFlipped((f) => !f)}
              >
                <RotateCcw className="h-4 w-4" /> Flip
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={index >= total - 1}
                onClick={() => {
                  setIndex((i) => Math.min(total - 1, i + 1));
                  setFlipped(false);
                }}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
