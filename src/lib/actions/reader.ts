"use server";

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { userHasBookAccess } from "@/lib/services/license";
import { scoreAttempt, type AnswerPayload } from "@/lib/services/quiz";
import { trackEvent } from "@/lib/services/analytics";

export type ReaderActionState = {
  ok: boolean;
  message?: string;
  data?: unknown;
};

async function verifyBookAccess(bookId: string) {
  const user = await requireUser();
  const access = await userHasBookAccess(user.id, bookId);
  if (!access.allowed) {
    return { user, allowed: false as const, reason: access.reason };
  }
  return { user, allowed: true as const, reason: access.reason };
}

export async function ensureBookAccess(
  bookId: string,
): Promise<ReaderActionState> {
  const parsed = z.string().min(1).safeParse(bookId);
  if (!parsed.success) return { ok: false, message: "Invalid book" };

  const result = await verifyBookAccess(parsed.data);
  if (!result.allowed) {
    return { ok: false, message: "You do not have access to this book." };
  }
  return { ok: true };
}

const progressSchema = z.object({
  bookId: z.string().min(1),
  chapterId: z.string().min(1),
  percentComplete: z.number().min(0).max(100),
  readingTimeSecDelta: z.number().min(0).optional(),
});

export async function saveReadingProgress(
  input: z.infer<typeof progressSchema>,
): Promise<ReaderActionState> {
  const parsed = progressSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid progress data" };
  }

  const access = await verifyBookAccess(parsed.data.bookId);
  if (!access.allowed) {
    return { ok: false, message: "Access denied" };
  }

  const chapter = await prisma.chapter.findFirst({
    where: { id: parsed.data.chapterId, bookId: parsed.data.bookId },
  });
  if (!chapter) return { ok: false, message: "Chapter not found" };

  const existing = await prisma.readingProgress.findUnique({
    where: {
      userId_bookId: {
        userId: access.user.id,
        bookId: parsed.data.bookId,
      },
    },
  });

  await prisma.readingProgress.upsert({
    where: {
      userId_bookId: {
        userId: access.user.id,
        bookId: parsed.data.bookId,
      },
    },
    create: {
      userId: access.user.id,
      bookId: parsed.data.bookId,
      chapterId: parsed.data.chapterId,
      percentComplete: parsed.data.percentComplete,
      lastLocation: parsed.data.chapterId,
      readingTimeSec: parsed.data.readingTimeSecDelta ?? 0,
    },
    update: {
      chapterId: parsed.data.chapterId,
      percentComplete: parsed.data.percentComplete,
      lastLocation: parsed.data.chapterId,
      readingTimeSec:
        (existing?.readingTimeSec ?? 0) +
        (parsed.data.readingTimeSecDelta ?? 0),
    },
  });

  return { ok: true };
}

const bookmarkSchema = z.object({
  bookId: z.string().min(1),
  chapterId: z.string().min(1),
  label: z.string().max(200).optional(),
  location: z.string().max(500).optional(),
});

export async function addBookmark(
  input: z.infer<typeof bookmarkSchema>,
): Promise<ReaderActionState> {
  const parsed = bookmarkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid bookmark" };

  const access = await verifyBookAccess(parsed.data.bookId);
  if (!access.allowed) return { ok: false, message: "Access denied" };

  const bookmark = await prisma.bookmark.create({
    data: {
      userId: access.user.id,
      bookId: parsed.data.bookId,
      chapterId: parsed.data.chapterId,
      label: parsed.data.label ?? "",
      location: parsed.data.location ?? "",
    },
  });

  return { ok: true, data: bookmark };
}

export async function deleteBookmark(bookmarkId: string): Promise<ReaderActionState> {
  const parsed = z.string().min(1).safeParse(bookmarkId);
  if (!parsed.success) return { ok: false, message: "Invalid bookmark" };

  const user = await requireUser();
  const bookmark = await prisma.bookmark.findFirst({
    where: { id: parsed.data, userId: user.id },
  });
  if (!bookmark) return { ok: false, message: "Bookmark not found" };

  await prisma.bookmark.delete({ where: { id: bookmark.id } });
  return { ok: true };
}

const highlightSchema = z.object({
  bookId: z.string().min(1),
  chapterId: z.string().min(1),
  text: z.string().min(1).max(2000),
  color: z.string().max(32).optional(),
  startOffset: z.number().int().min(0).optional(),
  endOffset: z.number().int().min(0).optional(),
});

export async function addHighlight(
  input: z.infer<typeof highlightSchema>,
): Promise<ReaderActionState> {
  const parsed = highlightSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid highlight" };

  const access = await verifyBookAccess(parsed.data.bookId);
  if (!access.allowed) return { ok: false, message: "Access denied" };

  const highlight = await prisma.highlight.create({
    data: {
      userId: access.user.id,
      bookId: parsed.data.bookId,
      chapterId: parsed.data.chapterId,
      text: parsed.data.text,
      color: parsed.data.color ?? "yellow",
      startOffset: parsed.data.startOffset ?? 0,
      endOffset: parsed.data.endOffset ?? 0,
    },
  });

  await trackEvent({
    type: "highlight",
    userId: access.user.id,
    bookId: parsed.data.bookId,
    metadata: { text: parsed.data.text.slice(0, 120), chapterId: parsed.data.chapterId },
  });

  return { ok: true, data: highlight };
}

export async function deleteHighlight(highlightId: string): Promise<ReaderActionState> {
  const parsed = z.string().min(1).safeParse(highlightId);
  if (!parsed.success) return { ok: false, message: "Invalid highlight" };

  const user = await requireUser();
  const highlight = await prisma.highlight.findFirst({
    where: { id: parsed.data, userId: user.id },
  });
  if (!highlight) return { ok: false, message: "Highlight not found" };

  await prisma.highlight.delete({ where: { id: highlight.id } });
  return { ok: true };
}

const noteCreateSchema = z.object({
  bookId: z.string().min(1),
  chapterId: z.string().min(1),
  body: z.string().min(1).max(5000),
});

export async function addNote(
  input: z.infer<typeof noteCreateSchema>,
): Promise<ReaderActionState> {
  const parsed = noteCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid note" };

  const access = await verifyBookAccess(parsed.data.bookId);
  if (!access.allowed) return { ok: false, message: "Access denied" };

  const note = await prisma.note.create({
    data: {
      userId: access.user.id,
      bookId: parsed.data.bookId,
      chapterId: parsed.data.chapterId,
      body: parsed.data.body,
    },
  });

  return { ok: true, data: note };
}

const noteUpdateSchema = z.object({
  noteId: z.string().min(1),
  body: z.string().min(1).max(5000),
});

export async function updateNote(
  input: z.infer<typeof noteUpdateSchema>,
): Promise<ReaderActionState> {
  const parsed = noteUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid note" };

  const user = await requireUser();
  const note = await prisma.note.findFirst({
    where: { id: parsed.data.noteId, userId: user.id },
  });
  if (!note) return { ok: false, message: "Note not found" };

  const updated = await prisma.note.update({
    where: { id: note.id },
    data: { body: parsed.data.body },
  });

  return { ok: true, data: updated };
}

export async function deleteNote(noteId: string): Promise<ReaderActionState> {
  const parsed = z.string().min(1).safeParse(noteId);
  if (!parsed.success) return { ok: false, message: "Invalid note" };

  const user = await requireUser();
  const note = await prisma.note.findFirst({
    where: { id: parsed.data, userId: user.id },
  });
  if (!note) return { ok: false, message: "Note not found" };

  await prisma.note.delete({ where: { id: note.id } });
  return { ok: true };
}

const answerPayloadSchema: z.ZodType<AnswerPayload> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("MULTIPLE_CHOICE"), optionId: z.string() }),
  z.object({ type: z.literal("MULTIPLE_ANSWER"), optionIds: z.array(z.string()) }),
  z.object({ type: z.literal("TRUE_FALSE"), value: z.boolean() }),
  z.object({ type: z.literal("FILL_BLANK"), text: z.string() }),
  z.object({ type: z.literal("MATCHING"), pairs: z.record(z.string(), z.string()) }),
  z.object({ type: z.literal("REFLECTION"), text: z.string() }),
]);

const quizSchema = z.object({
  bookId: z.string().min(1),
  chapterId: z.string().min(1),
  answers: z.record(z.string(), answerPayloadSchema),
});

export async function submitChapterQuiz(
  input: z.infer<typeof quizSchema>,
): Promise<ReaderActionState> {
  const parsed = quizSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid quiz submission" };

  const access = await verifyBookAccess(parsed.data.bookId);
  if (!access.allowed) return { ok: false, message: "Access denied" };

  const questions = await prisma.question.findMany({
    where: { chapterId: parsed.data.chapterId },
    include: { options: { orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });

  if (questions.length === 0) {
    return { ok: false, message: "No questions for this chapter" };
  }

  const { score, maxScore, details } = scoreAttempt(
    questions,
    parsed.data.answers,
  );

  const attempt = await prisma.attempt.create({
    data: {
      userId: access.user.id,
      bookId: parsed.data.bookId,
      chapterId: parsed.data.chapterId,
      score,
      maxScore,
      completed: true,
      answers: {
        create: details.map((d) => ({
          questionId: d.questionId,
          answerJson: (d.answer ?? {}) as Prisma.InputJsonValue,
          isCorrect: d.isCorrect,
          pointsEarned: d.pointsEarned,
        })),
      },
    },
  });

  await trackEvent({
    type: "quiz_submit",
    userId: access.user.id,
    bookId: parsed.data.bookId,
    metadata: {
      chapterId: parsed.data.chapterId,
      score,
      maxScore,
      attemptId: attempt.id,
    },
  });

  return {
    ok: true,
    data: { score, maxScore, attemptId: attempt.id, details },
  };
}

const readerEventSchema = z.object({
  bookId: z.string().min(1),
  type: z.enum([
    "book_open",
    "chapter_complete",
    "search",
    "highlight",
    "quiz_submit",
  ]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function trackReaderEvent(
  input: z.infer<typeof readerEventSchema>,
): Promise<ReaderActionState> {
  const parsed = readerEventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid event" };

  const access = await verifyBookAccess(parsed.data.bookId);
  if (!access.allowed) return { ok: false, message: "Access denied" };

  await trackEvent({
    type: parsed.data.type,
    userId: access.user.id,
    bookId: parsed.data.bookId,
    metadata: parsed.data.metadata,
  });

  return { ok: true };
}
