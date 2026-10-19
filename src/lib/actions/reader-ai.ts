"use server";

import { z } from "zod";
import type { AIGenerationType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { userHasBookAccess } from "@/lib/services/license";
import { getAIService } from "@/lib/ai";
import type { AIFeature } from "@/lib/ai";
import { buildBookAIContext } from "@/lib/ai/context";
import { parseFlashcardDeck, parsePracticeQuiz } from "@/lib/ai/parse-study";
import type { StudyFlashcardDeck, StudyQuiz } from "@/lib/ai/study-types";
import { synthesizeSpeech } from "@/lib/ai/tts";

export type ReaderAIResult = {
  ok: boolean;
  message?: string;
  content?: string;
  feature?: AIFeature;
  labeled?: true;
  flashcards?: StudyFlashcardDeck;
  quiz?: StudyQuiz;
  provider?: string;
};

export type TutorSpeechResult = {
  ok: boolean;
  message?: string;
  audioBase64?: string;
  mimeType?: string;
};

export type AudioOverviewResult = {
  ok: boolean;
  message?: string;
  title?: string;
  script?: string;
  audioBase64?: string;
  mimeType?: string;
};

const featureToType: Record<AIFeature, AIGenerationType> = {
  chapter_summary: "CHAPTER_SUMMARY",
  flashcards: "FLASHCARDS",
  practice_questions: "PRACTICE_QUESTIONS",
  ask_book: "ASK_BOOK",
  next_chapter: "NEXT_CHAPTER",
  reading_level: "READING_LEVEL",
  teach_book: "TEACH_BOOK",
  study_guide: "STUDY_GUIDE",
  explain: "EXPLAIN",
};

const schema = z.object({
  feature: z.enum([
    "chapter_summary",
    "flashcards",
    "practice_questions",
    "ask_book",
    "next_chapter",
    "reading_level",
    "teach_book",
    "study_guide",
    "explain",
  ]),
  bookId: z.string().min(1),
  chapterId: z.string().optional(),
  question: z.string().optional(),
  targetLevel: z.string().optional(),
});

export async function runReaderAI(input: {
  feature: AIFeature;
  bookId: string;
  chapterId?: string;
  question?: string;
  targetLevel?: string;
}): Promise<ReaderAIResult> {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid AI request" };
  }

  const access = await userHasBookAccess(user.id, parsed.data.bookId);
  if (!access.allowed) {
    return { ok: false, message: "You need access to this book to use AI tools" };
  }

  // AI tutoring uses the PDF only — chapterId is ignored for generation.
  const ctx = await buildBookAIContext({
    bookId: parsed.data.bookId,
    question: parsed.data.question,
    targetLevel: parsed.data.targetLevel,
  });
  if (!ctx) return { ok: false, message: "Book not found" };

  if (!ctx.hasPdfText) {
    return {
      ok: false,
      message:
        "Could not open this book’s PDF. Re-upload the PDF file, then try again.",
    };
  }

  const ai = getAIService();
  let response;
  switch (parsed.data.feature) {
    case "chapter_summary":
      response = await ai.generateChapterSummary(ctx);
      break;
    case "flashcards":
      response = await ai.generateFlashcards(ctx);
      break;
    case "practice_questions":
      response = await ai.generatePracticeQuestions(ctx);
      break;
    case "ask_book":
      response = await ai.askBook(ctx);
      break;
    case "next_chapter":
      response = await ai.recommendNextChapter(ctx);
      break;
    case "reading_level":
      response = await ai.adjustReadingLevel(ctx);
      break;
    case "teach_book":
      response = await ai.teachWholeBook(ctx);
      break;
    case "study_guide":
      response = await ai.generateStudyGuide(ctx);
      break;
    case "explain":
      response = await ai.explainConcept(ctx);
      break;
  }

  await prisma.aIGenerationRequest.create({
    data: {
      type: featureToType[parsed.data.feature],
      status: "COMPLETED",
      bookId: parsed.data.bookId,
      chapterId: null,
      userId: user.id,
      prompt:
        parsed.data.question?.trim() ||
        parsed.data.feature.replace(/_/g, " "),
      result: response.content,
    },
  });

  const result: ReaderAIResult = {
    ok: true,
    content: response.content,
    feature: parsed.data.feature,
    labeled: true,
    provider: response.provider,
    message: "AI tutor response — verify important facts against the PDF.",
  };

  if (parsed.data.feature === "flashcards") {
    result.flashcards = parseFlashcardDeck(
      response.content,
      `Flashcards — ${ctx.bookTitle}`,
    );
    result.content = result.flashcards.cards
      .map((c, i) => `Card ${i + 1}\nQ: ${c.front}\nA: ${c.back}`)
      .join("\n\n");
  }

  if (parsed.data.feature === "practice_questions") {
    result.quiz = parsePracticeQuiz(
      response.content,
      `Practice quiz — ${ctx.bookTitle}`,
    );
    result.content = result.quiz.questions
      .map((q, i) => `${i + 1}. (${q.type}) ${q.prompt}`)
      .join("\n");
  }

  return result;
}

export async function synthesizeTutorSpeech(input: {
  bookId: string;
  text: string;
}): Promise<TutorSpeechResult> {
  const user = await requireUser();
  const bookId = String(input.bookId ?? "").trim();
  const text = String(input.text ?? "").trim();

  if (!bookId || !text) {
    return { ok: false, message: "Nothing to narrate" };
  }

  const access = await userHasBookAccess(user.id, bookId);
  if (!access.allowed) {
    return { ok: false, message: "You need access to this book to use voice tutoring" };
  }

  try {
    const audio = await synthesizeSpeech(text);
    return {
      ok: true,
      audioBase64: audio.audioBase64,
      mimeType: audio.mimeType,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not create an audio recording",
    };
  }
}

/** NotebookLM-style Audio Overview — generate once, replay anytime. */
export async function generateAudioOverview(input: {
  bookId: string;
}): Promise<AudioOverviewResult> {
  const user = await requireUser();
  const bookId = String(input.bookId ?? "").trim();
  if (!bookId) return { ok: false, message: "Book ID is required" };

  const access = await userHasBookAccess(user.id, bookId);
  if (!access.allowed) {
    return { ok: false, message: "You need access to this book" };
  }

  const ctx = await buildBookAIContext({ bookId });
  if (!ctx) return { ok: false, message: "Book not found" };
  if (!ctx.hasPdfText) {
    return {
      ok: false,
      message: "Could not open this book’s PDF. Re-upload it, then try again.",
    };
  }

  const ai = getAIService();
  const scriptRes = await ai.askBook({
    ...ctx,
    question: [
      "Write a NotebookLM-style Audio Overview script for this PDF.",
      "Single friendly host. Speak directly to the student.",
      "Cover: what the book is about, 4–6 key ideas, one practical tip, short closing.",
      "Keep it under 450 words so it can be narrated in about 2–3 minutes.",
      "Plain spoken prose only — no markdown, no bullet markers, no stage directions.",
      "Do not invent facts beyond the PDF.",
    ].join(" "),
  });

  const script = (scriptRes.content || "").trim();
  if (!script) {
    return { ok: false, message: "Could not write an audio overview script" };
  }

  try {
    const audio = await synthesizeSpeech(script);
    const title = `Audio Overview — ${ctx.bookTitle}`;

    await prisma.aIGenerationRequest.create({
      data: {
        type: "CHAPTER_SUMMARY",
        status: "COMPLETED",
        bookId,
        chapterId: null,
        userId: user.id,
        prompt: "audio_overview",
        result: script,
      },
    });

    return {
      ok: true,
      title,
      script,
      audioBase64: audio.audioBase64,
      mimeType: audio.mimeType,
      message: "Audio Overview ready — play it anytime while you read.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not narrate the Audio Overview",
      script,
    };
  }
}
