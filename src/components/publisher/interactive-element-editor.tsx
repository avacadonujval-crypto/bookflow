"use client";

import { useEffect, useMemo, useState, useActionState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  saveContentBlock,
  saveQuestion,
  type BookActionState,
} from "@/lib/actions/books";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Chapter = { id: string; title: string; order: number };

const QUESTION_TYPES = [
  "MULTIPLE_CHOICE",
  "MULTIPLE_ANSWER",
  "TRUE_FALSE",
  "FILL_BLANK",
  "MATCHING",
  "REFLECTION",
] as const;

const BLOCK_TYPES = [
  "VIDEO",
  "AUDIO",
  "EXTERNAL_LINK",
  "GLOSSARY",
  "IMAGE_HOTSPOT",
] as const;

type EditorKind = "question" | "block";

const initial: BookActionState = { ok: false };

export function InteractiveElementEditor({
  bookId,
  chapters,
}: {
  bookId: string;
  chapters: Chapter[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramChapter = searchParams.get("chapter");
  const activeChapter =
    chapters.find((c) => c.id === paramChapter) ?? chapters[0] ?? null;

  const [kind, setKind] = useState<EditorKind>("question");
  const [questionType, setQuestionType] =
    useState<(typeof QUESTION_TYPES)[number]>("MULTIPLE_CHOICE");
  const [blockType, setBlockType] =
    useState<(typeof BLOCK_TYPES)[number]>("VIDEO");

  const [prompt, setPrompt] = useState("");
  const [explanation, setExplanation] = useState("");
  const [feedback, setFeedback] = useState("");
  const [points, setPoints] = useState(1);
  const [correctText, setCorrectText] = useState("");
  const [optionsText, setOptionsText] = useState(
    "Option A|true\nOption B|false\nOption C|false",
  );
  const [matchingJson, setMatchingJson] = useState(
    '[{"left":"Term","right":"Definition"}]',
  );
  const [blockTitle, setBlockTitle] = useState("");
  const [blockBody, setBlockBody] = useState("");
  const [metadataJson, setMetadataJson] = useState("{}");

  const [qState, qAction, qPending] = useActionState(saveQuestion, initial);
  const [bState, bAction, bPending] = useActionState(saveContentBlock, initial);
  const state = kind === "question" ? qState : bState;
  const pending = kind === "question" ? qPending : bPending;

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  const parsedOptions = useMemo(() => {
    return optionsText
      .split("\n")
      .map((line, index) => {
        const [label, correctFlag] = line.split("|");
        const labelTrim = (label ?? "").trim();
        if (!labelTrim) return null;
        return {
          label: labelTrim,
          isCorrect: (correctFlag ?? "").trim().toLowerCase() === "true",
          order: index,
        };
      })
      .filter(Boolean);
  }, [optionsText]);

  const preview = useMemo(() => {
    if (kind === "question") {
      return {
        heading: questionType.replace(/_/g, " "),
        body: prompt,
        meta: [
          `Points: ${points}`,
          explanation ? `Explanation: ${explanation}` : null,
          feedback ? `Feedback: ${feedback}` : null,
          correctText ? `Expected: ${correctText}` : null,
          parsedOptions.length
            ? `Options: ${parsedOptions.map((o) => o!.label).join(", ")}`
            : null,
        ].filter(Boolean),
      };
    }
    return {
      heading: blockType.replace(/_/g, " "),
      body: blockBody || blockTitle,
      meta: [blockTitle ? `Title: ${blockTitle}` : null],
    };
  }, [
    kind,
    questionType,
    blockType,
    prompt,
    points,
    explanation,
    feedback,
    correctText,
    parsedOptions,
    blockBody,
    blockTitle,
  ]);

  if (!activeChapter) {
    return (
      <p className="text-sm text-muted-foreground">
        Add chapters to this book before creating interactive elements.
      </p>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={kind === "question" ? "default" : "outline"}
            onClick={() => setKind("question")}
          >
            Assessment question
          </Button>
          <Button
            type="button"
            size="sm"
            variant={kind === "block" ? "default" : "outline"}
            onClick={() => setKind("block")}
          >
            Content block
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="chapter">Chapter</Label>
          <select
            id="chapter"
            value={activeChapter.id}
            onChange={(e) =>
              router.push(
                `/publisher/books/${bookId}/author/elements?chapter=${e.target.value}`,
              )
            }
            className="flex h-10 w-full max-w-md rounded-lg border border-neutral-200 bg-white px-3 text-sm"
          >
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.order + 1}. {ch.title}
              </option>
            ))}
          </select>
        </div>

        {kind === "question" ? (
          <form action={qAction} className="space-y-4">
            <input type="hidden" name="bookId" value={bookId} />
            <input type="hidden" name="chapterId" value={activeChapter.id} />
            <input type="hidden" name="type" value={questionType} />
            <input
              type="hidden"
              name="options"
              value={JSON.stringify(parsedOptions)}
            />
            <input type="hidden" name="matchingJson" value={matchingJson} />

            <div className="space-y-2">
              <Label htmlFor="type">Question type</Label>
              <select
                id="type"
                value={questionType}
                onChange={(e) =>
                  setQuestionType(
                    e.target.value as (typeof QUESTION_TYPES)[number],
                  )
                }
                className="flex h-10 w-full max-w-md rounded-lg border border-neutral-200 bg-white px-3 text-sm"
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                name="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                required
              />
            </div>

            {(questionType === "MULTIPLE_CHOICE" ||
              questionType === "MULTIPLE_ANSWER") && (
              <div className="space-y-2">
                <Label htmlFor="optionsText">
                  Options (one per line, use label|true or label|false)
                </Label>
                <Textarea
                  id="optionsText"
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  rows={5}
                  className="font-mono text-xs"
                />
              </div>
            )}

            {questionType === "FILL_BLANK" || questionType === "REFLECTION" ? (
              <div className="space-y-2">
                <Label htmlFor="correctText">
                  {questionType === "FILL_BLANK"
                    ? "Correct answer text"
                    : "Reflection guidance"}
                </Label>
                <Input
                  id="correctText"
                  name="correctText"
                  value={correctText}
                  onChange={(e) => setCorrectText(e.target.value)}
                />
              </div>
            ) : (
              <input type="hidden" name="correctText" value={correctText} />
            )}

            {questionType === "MATCHING" ? (
              <div className="space-y-2">
                <Label htmlFor="matchingJson">Matching pairs (JSON)</Label>
                <Textarea
                  id="matchingJson"
                  value={matchingJson}
                  onChange={(e) => setMatchingJson(e.target.value)}
                  rows={4}
                  className="font-mono text-xs"
                />
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="points">Points</Label>
                <Input
                  id="points"
                  name="points"
                  type="number"
                  min={0}
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="explanation">Explanation</Label>
                <Input
                  id="explanation"
                  name="explanation"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback">Feedback</Label>
              <Textarea
                id="feedback"
                name="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={2}
              />
            </div>

            {qState.message ? (
              <p
                className={`text-sm ${qState.ok ? "text-foreground" : "text-foreground"}`}
              >
                {qState.message}
              </p>
            ) : null}

            <Button type="submit" disabled={pending}>
              Save question
            </Button>
          </form>
        ) : (
          <form action={bAction} className="space-y-4">
            <input type="hidden" name="bookId" value={bookId} />
            <input type="hidden" name="chapterId" value={activeChapter.id} />
            <input type="hidden" name="type" value={blockType} />
            <input type="hidden" name="metadataJson" value={metadataJson} />

            <div className="space-y-2">
              <Label htmlFor="blockType">Content block type</Label>
              <select
                id="blockType"
                value={blockType}
                onChange={(e) =>
                  setBlockType(e.target.value as (typeof BLOCK_TYPES)[number])
                }
                className="flex h-10 w-full max-w-md rounded-lg border border-neutral-200 bg-white px-3 text-sm"
              >
                {BLOCK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="blockTitle">Title</Label>
              <Input
                id="blockTitle"
                name="title"
                value={blockTitle}
                onChange={(e) => setBlockTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="blockBody">
                Body / URL / embed code / glossary text
              </Label>
              <Textarea
                id="blockBody"
                name="body"
                value={blockBody}
                onChange={(e) => setBlockBody(e.target.value)}
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="metadataJson">Metadata (JSON)</Label>
              <Textarea
                id="metadataJson"
                value={metadataJson}
                onChange={(e) => setMetadataJson(e.target.value)}
                rows={3}
                className="font-mono text-xs"
              />
            </div>

            {bState.message ? (
              <p
                className={`text-sm ${bState.ok ? "text-foreground" : "text-foreground"}`}
              >
                {bState.message}
              </p>
            ) : null}

            <Button type="submit" disabled={pending}>
              Save content block
            </Button>
          </form>
        )}
      </div>

      <aside className="h-fit rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Learner preview
        </p>
        <h3 className="mt-2 text-lg font-semibold text-foreground">
          {preview.heading}
        </h3>
        <p className="mt-2 text-sm text-neutral-700">{preview.body || "—"}</p>
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {preview.meta.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-neutral-400">
          Chapter {activeChapter.order + 1}: {activeChapter.title}
        </p>
      </aside>
    </div>
  );
}
