"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AIGenerationStatus, AIGenerationType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { getAIService } from "@/lib/ai";
import type { AIFeature } from "@/lib/ai";
import { buildBookAIContext } from "@/lib/ai/context";
import { writeAuditLog } from "@/lib/audit";

export type AIActionState = {
  ok: boolean;
  message?: string;
  requestId?: string;
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

const generateSchema = z.object({
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

export async function generateAIContent(
  _prev: AIActionState,
  formData: FormData,
): Promise<AIActionState> {
  const user = await requireRole("PUBLISHER");

  const parsed = generateSchema.safeParse({
    feature: formData.get("feature"),
    bookId: formData.get("bookId"),
    chapterId: formData.get("chapterId") || undefined,
    question: formData.get("question") || undefined,
    targetLevel: formData.get("targetLevel") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const book = await prisma.book.findUnique({
    where: { id: parsed.data.bookId },
    select: { id: true, publisherId: true },
  });
  if (!book || book.publisherId !== user.id) {
    return { ok: false, message: "Book not found or access denied" };
  }

  const requestContext = await buildBookAIContext({
    bookId: parsed.data.bookId,
    chapterId: parsed.data.chapterId,
    question: parsed.data.question,
    targetLevel: parsed.data.targetLevel,
  });
  if (!requestContext) {
    return { ok: false, message: "Book not found or access denied" };
  }

  const ai = getAIService();
  let response;
  switch (parsed.data.feature) {
    case "chapter_summary":
      response = await ai.generateChapterSummary(requestContext);
      break;
    case "flashcards":
      response = await ai.generateFlashcards(requestContext);
      break;
    case "practice_questions":
      response = await ai.generatePracticeQuestions(requestContext);
      break;
    case "ask_book":
      response = await ai.askBook(requestContext);
      break;
    case "next_chapter":
      response = await ai.recommendNextChapter(requestContext);
      break;
    case "reading_level":
      response = await ai.adjustReadingLevel(requestContext);
      break;
    case "teach_book":
      response = await ai.teachWholeBook(requestContext);
      break;
    case "study_guide":
      response = await ai.generateStudyGuide(requestContext);
      break;
    case "explain":
      response = await ai.explainConcept(requestContext);
      break;
  }

  const prompt =
    parsed.data.question?.trim() ||
    `${parsed.data.feature}${parsed.data.targetLevel ? ` (${parsed.data.targetLevel})` : ""}`;

  const record = await prisma.aIGenerationRequest.create({
    data: {
      type: featureToType[parsed.data.feature],
      status: "COMPLETED",
      bookId: parsed.data.bookId,
      chapterId: parsed.data.chapterId ?? null,
      userId: user.id,
      prompt,
      result: response.content,
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: "ai.generate",
    entityType: "AIGenerationRequest",
    entityId: record.id,
    metadata: { type: record.type, feature: parsed.data.feature },
  });

  revalidatePath("/publisher/ai");
  return {
    ok: true,
    message: "AI content generated — review required before publishing.",
    requestId: record.id,
  };
}

const reviewSchema = z.object({
  requestId: z.string().min(1),
  status: z.enum(["REVIEWED", "REJECTED", "PUBLISHED"]),
});

export async function updateAIRequestStatus(
  _prev: AIActionState,
  formData: FormData,
): Promise<AIActionState> {
  const user = await requireRole("PUBLISHER");

  const parsed = reviewSchema.safeParse({
    requestId: formData.get("requestId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Invalid review action" };
  }

  const existing = await prisma.aIGenerationRequest.findUnique({
    where: { id: parsed.data.requestId },
    include: { book: { select: { publisherId: true } } },
  });

  const ownsRequest =
    existing?.userId === user.id ||
    existing?.book?.publisherId === user.id;
  if (!existing || !ownsRequest) {
    return { ok: false, message: "Request not found or access denied" };
  }

  const status = parsed.data.status as AIGenerationStatus;

  await prisma.aIGenerationRequest.update({
    where: { id: parsed.data.requestId },
    data: {
      status,
      reviewedAt: new Date(),
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: `ai.${status.toLowerCase()}`,
    entityType: "AIGenerationRequest",
    entityId: parsed.data.requestId,
  });

  revalidatePath("/publisher/ai");
  return { ok: true, message: `Marked as ${status.toLowerCase()}` };
}

export async function generateAIContentForm(formData: FormData): Promise<void> {
  await generateAIContent({ ok: false }, formData);
}

export async function updateAIRequestStatusForm(formData: FormData): Promise<void> {
  await updateAIRequestStatus({ ok: false }, formData);
}
