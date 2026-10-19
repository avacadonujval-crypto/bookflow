"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import path from "path";
import {
  BookStatus,
  ContentBlockType,
  QuestionType,
  type Prisma,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { getStorage } from "@/lib/storage";
import { nextPublishedVersion } from "@/lib/services/publishing";

export type BookActionState = {
  ok: boolean;
  message?: string;
  bookId?: string;
  questionId?: string;
  contentBlockId?: string;
};

const metadataSchema = z.object({
  bookId: z.string().min(1).optional(),
  title: z.string().trim().min(1, "Title is required").max(200),
  author: z.string().trim().min(1, "Author is required").max(120),
  description: z.string().trim().max(5000).optional(),
  subject: z.string().trim().max(120).optional(),
  language: z.string().trim().min(2).max(10).optional(),
});

const chapterInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Chapter title is required").max(200),
  order: z.coerce.number().int().min(0),
  content: z.string().optional(),
  pageStart: z.coerce.number().int().min(0).optional().nullable(),
  pageEnd: z.coerce.number().int().min(0).optional().nullable(),
});

const chaptersPayloadSchema = z.object({
  bookId: z.string().min(1),
  chapters: z.array(chapterInputSchema).min(1),
});

const chapterContentSchema = z.object({
  bookId: z.string().min(1),
  chapterId: z.string().min(1),
  content: z.string(),
});

const questionTypeSchema = z.enum([
  "MULTIPLE_CHOICE",
  "MULTIPLE_ANSWER",
  "TRUE_FALSE",
  "FILL_BLANK",
  "MATCHING",
  "REFLECTION",
]);

const contentBlockTypeSchema = z.enum([
  "VIDEO",
  "AUDIO",
  "EXTERNAL_LINK",
  "GLOSSARY",
  "IMAGE_HOTSPOT",
  "TEXT",
  "IMAGE",
]);

const optionSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1),
  isCorrect: z.boolean(),
  order: z.coerce.number().int().min(0),
});

const saveQuestionSchema = z.object({
  bookId: z.string().min(1),
  chapterId: z.string().min(1),
  questionId: z.string().optional(),
  type: questionTypeSchema,
  prompt: z.string().trim().min(1, "Prompt is required"),
  explanation: z.string().trim().optional(),
  feedback: z.string().trim().optional(),
  points: z.coerce.number().int().min(0).max(100).optional(),
  order: z.coerce.number().int().min(0).optional(),
  correctText: z.string().trim().optional(),
  matchingJson: z.string().optional(),
  hotspotJson: z.string().optional(),
  options: z.array(optionSchema).optional(),
});

const saveContentBlockSchema = z.object({
  bookId: z.string().min(1),
  chapterId: z.string().min(1),
  contentBlockId: z.string().optional(),
  type: contentBlockTypeSchema,
  title: z.string().trim().max(200).optional(),
  body: z.string().trim().optional(),
  order: z.coerce.number().int().min(0).optional(),
  metadataJson: z.string().optional(),
});

const ALLOWED_BOOK_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "application/epub+zip": "epub",
  "application/x-epub+zip": "epub",
};

const ALLOWED_COVER_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

async function requirePublisher() {
  return requireRole("PUBLISHER");
}

async function assertBookOwner(bookId: string, publisherId: string) {
  const book = await prisma.book.findFirst({
    where: { id: bookId, publisherId },
  });
  if (!book) {
    throw new Error("Book not found or access denied");
  }
  return book;
}

function revalidateBookPaths(bookId: string) {
  revalidatePath("/publisher/books");
  revalidatePath(`/publisher/books/${bookId}`);
  revalidatePath(`/publisher/books/${bookId}/author`);
  revalidatePath(`/publisher/books/${bookId}/author/elements`);
  revalidatePath("/publisher/books");
  revalidatePath("/publisher");
}

function parseJsonField(raw: string | undefined): Prisma.InputJsonValue | undefined {
  if (!raw?.trim()) return undefined;
  try {
    return JSON.parse(raw) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

function defaultPlaceholderChapters(count: number) {
  const n = Math.min(6, Math.max(3, count));
  return Array.from({ length: n }, (_, i) => ({
    title: `Chapter ${i + 1}`,
    order: i,
    content: "<p>Start writing this chapter…</p>",
  }));
}

function friendlyDbError(e: unknown, fallback: string) {
  const msg = e instanceof Error ? e.message : String(e);
  if (
    msg.includes("Foreign key constraint") ||
    msg.includes("Book_publisherId_fkey")
  ) {
    return "Your session is out of date (database was reset). Sign out, sign in again as publisher@bookflow.local, then retry the upload.";
  }
  if (msg.includes("Unique constraint")) {
    return "A conflicting record already exists. Try a different title or refresh the page.";
  }
  // Never leak Prisma / Turbopack stack traces into the UI
  if (msg.includes("prisma") || msg.includes("TURBOPACK") || msg.includes("\n")) {
    return fallback;
  }
  return msg || fallback;
}

export async function createBookDraft(
  _prev: BookActionState,
  formData: FormData,
): Promise<BookActionState> {
  try {
    const user = await requirePublisher();

    const publisher = await prisma.user.findUnique({ where: { id: user.id } });
    if (!publisher || publisher.role !== "PUBLISHER") {
      return {
        ok: false,
        message:
          "Publisher account not found. Sign out and sign in again as publisher@bookflow.local.",
      };
    }

    const parsed = metadataSchema.safeParse({
      title: formData.get("title") ?? "Untitled draft",
      author: formData.get("author") ?? publisher.name,
      description: formData.get("description") ?? "",
      subject: formData.get("subject") ?? "",
      language: formData.get("language") ?? "en",
    });

    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Invalid metadata",
      };
    }

    const book = await prisma.book.create({
      data: {
        title: parsed.data.title || "Untitled draft",
        author: parsed.data.author || publisher.name,
        description: parsed.data.description ?? "",
        subject: parsed.data.subject ?? "",
        language: parsed.data.language ?? "en",
        status: BookStatus.DRAFT,
        publisherId: publisher.id,
        coverUrl: "/covers/sample-cover.svg",
        chapters: {
          create: defaultPlaceholderChapters(4),
        },
      },
    });

    await writeAuditLog({
      userId: publisher.id,
      action: "book.create_draft",
      entityType: "Book",
      entityId: book.id,
      metadata: { title: book.title },
    });

    revalidateBookPaths(book.id);

    return { ok: true, bookId: book.id, message: "Draft created" };
  } catch (e) {
    return {
      ok: false,
      message: friendlyDbError(e, "Failed to create draft"),
    };
  }
}

export async function updateBookMetadata(
  _prev: BookActionState,
  formData: FormData,
): Promise<BookActionState> {
  try {
    const user = await requirePublisher();
    const parsed = metadataSchema.safeParse({
      bookId: formData.get("bookId"),
      title: formData.get("title"),
      author: formData.get("author"),
      description: formData.get("description"),
      subject: formData.get("subject"),
      language: formData.get("language"),
    });

    if (!parsed.success || !parsed.data.bookId) {
      return {
        ok: false,
        message: parsed.error?.issues[0]?.message ?? "Book ID is required",
      };
    }

    await assertBookOwner(parsed.data.bookId, user.id);

    const book = await prisma.book.update({
      where: { id: parsed.data.bookId },
      data: {
        title: parsed.data.title,
        author: parsed.data.author,
        description: parsed.data.description ?? "",
        subject: parsed.data.subject ?? "",
        language: parsed.data.language ?? "en",
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "book.update_metadata",
      entityType: "Book",
      entityId: book.id,
    });

    revalidateBookPaths(book.id);
    return { ok: true, bookId: book.id, message: "Metadata saved" };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Failed to update metadata",
    };
  }
}

export async function uploadBookFile(
  _prev: BookActionState,
  formData: FormData,
): Promise<BookActionState> {
  try {
    const user = await requirePublisher();
    const bookId = String(formData.get("bookId") ?? "");
    const file = formData.get("file");

    if (!bookId) {
      return { ok: false, message: "Book ID is required" };
    }
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: "Select a PDF or EPUB file" };
    }
    if (file.size > 50 * 1024 * 1024) {
      return { ok: false, message: "File must be under 50 MB" };
    }

    const nameLower = file.name.toLowerCase();
    const extFromName = nameLower.endsWith(".pdf")
      ? "pdf"
      : nameLower.endsWith(".epub")
        ? "epub"
        : null;
    const ext = ALLOWED_BOOK_MIME[file.type] ?? extFromName;
    if (!ext) {
      return { ok: false, message: "Only PDF and EPUB files are supported" };
    }

    const book = await assertBookOwner(bookId, user.id);
    const storage = getStorage();
    const key = path.posix.join("books", bookId, `source-${randomUUID()}.${ext}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storage.upload({
      key,
      data: buffer,
      contentType: file.type,
    });

    if (book.fileUrl) {
      const oldKey = book.fileUrl.replace(/^\/api\/files\//, "");
      await storage.delete(oldKey);
    }

    await prisma.book.update({
      where: { id: bookId },
      data: {
        fileUrl: stored.url,
        fileType: ext,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "book.upload_file",
      entityType: "Book",
      entityId: bookId,
      metadata: { fileType: ext, size: stored.size },
    });

    revalidateBookPaths(bookId);
    return { ok: true, bookId, message: "Book file uploaded" };
  } catch (e) {
    return {
      ok: false,
      message: friendlyDbError(e, "Upload failed"),
    };
  }
}

export async function uploadCover(
  _prev: BookActionState,
  formData: FormData,
): Promise<BookActionState> {
  try {
    const user = await requirePublisher();
    const bookId = String(formData.get("bookId") ?? "");
    const file = formData.get("file");
    const useDefault = formData.get("useDefault") === "true";

    if (!bookId) {
      return { ok: false, message: "Book ID is required" };
    }

    const book = await assertBookOwner(bookId, user.id);
    const storage = getStorage();

    if (useDefault) {
      await prisma.book.update({
        where: { id: bookId },
        data: { coverUrl: "/covers/sample-cover.svg" },
      });
      revalidateBookPaths(bookId);
      return { ok: true, bookId, message: "Default cover applied" };
    }

    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: "Select a cover image" };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { ok: false, message: "Cover must be under 5 MB" };
    }

    const ext = ALLOWED_COVER_MIME[file.type];
    if (!ext) {
      return {
        ok: false,
        message: "Cover must be JPEG, PNG, WebP, or SVG",
      };
    }

    const key = path.posix.join("books", bookId, `cover-${randomUUID()}.${ext}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storage.upload({
      key,
      data: buffer,
      contentType: file.type,
    });

    if (book.coverUrl?.startsWith("/api/files/")) {
      const oldKey = book.coverUrl.replace(/^\/api\/files\//, "");
      await storage.delete(oldKey);
    }

    await prisma.book.update({
      where: { id: bookId },
      data: { coverUrl: stored.url },
    });

    await writeAuditLog({
      userId: user.id,
      action: "book.upload_cover",
      entityType: "Book",
      entityId: bookId,
    });

    revalidateBookPaths(bookId);
    return { ok: true, bookId, message: "Cover uploaded" };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Cover upload failed",
    };
  }
}

export async function saveChapters(
  _prev: BookActionState,
  formData: FormData,
): Promise<BookActionState> {
  try {
    const user = await requirePublisher();
    const rawChapters = formData.get("chapters");
    let chapters: z.infer<typeof chapterInputSchema>[] = [];

    if (typeof rawChapters === "string" && rawChapters.trim()) {
      try {
        chapters = JSON.parse(rawChapters) as z.infer<typeof chapterInputSchema>[];
      } catch {
        return { ok: false, message: "Invalid chapter data" };
      }
    }

    const parsed = chaptersPayloadSchema.safeParse({
      bookId: formData.get("bookId"),
      chapters,
    });

    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Invalid chapters",
      };
    }

    await assertBookOwner(parsed.data.bookId, user.id);

    const existing = await prisma.chapter.findMany({
      where: { bookId: parsed.data.bookId },
      select: { id: true },
    });
    const incomingIds = new Set(
      parsed.data.chapters.map((c) => c.id).filter(Boolean) as string[],
    );
    const toDelete = existing.filter((c) => !incomingIds.has(c.id)).map((c) => c.id);

    await prisma.$transaction(async (tx) => {
      if (toDelete.length) {
        await tx.chapter.deleteMany({ where: { id: { in: toDelete } } });
      }

      for (const ch of parsed.data.chapters) {
        if (ch.id) {
          await tx.chapter.update({
            where: { id: ch.id },
            data: {
              title: ch.title,
              order: ch.order,
              content: ch.content ?? undefined,
              pageStart: ch.pageStart ?? null,
              pageEnd: ch.pageEnd ?? null,
            },
          });
        } else {
          await tx.chapter.create({
            data: {
              bookId: parsed.data.bookId,
              title: ch.title,
              order: ch.order,
              content: ch.content ?? "",
              pageStart: ch.pageStart ?? null,
              pageEnd: ch.pageEnd ?? null,
            },
          });
        }
      }
    });

    await writeAuditLog({
      userId: user.id,
      action: "book.save_chapters",
      entityType: "Book",
      entityId: parsed.data.bookId,
      metadata: { count: parsed.data.chapters.length },
    });

    revalidateBookPaths(parsed.data.bookId);
    return { ok: true, bookId: parsed.data.bookId, message: "Chapters saved" };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Failed to save chapters",
    };
  }
}

export async function updateChapterContent(
  _prev: BookActionState,
  formData: FormData,
): Promise<BookActionState> {
  try {
    const user = await requirePublisher();
    const parsed = chapterContentSchema.safeParse({
      bookId: formData.get("bookId"),
      chapterId: formData.get("chapterId"),
      content: formData.get("content") ?? "",
    });

    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Invalid chapter content",
      };
    }

    await assertBookOwner(parsed.data.bookId, user.id);

    const chapter = await prisma.chapter.findFirst({
      where: { id: parsed.data.chapterId, bookId: parsed.data.bookId },
    });
    if (!chapter) {
      return { ok: false, message: "Chapter not found" };
    }

    await prisma.chapter.update({
      where: { id: parsed.data.chapterId },
      data: { content: parsed.data.content },
    });

    await writeAuditLog({
      userId: user.id,
      action: "book.update_chapter_content",
      entityType: "Chapter",
      entityId: parsed.data.chapterId,
      metadata: { bookId: parsed.data.bookId },
    });

    revalidateBookPaths(parsed.data.bookId);
    return {
      ok: true,
      bookId: parsed.data.bookId,
      message: "Chapter content saved",
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Failed to save content",
    };
  }
}

export async function publishBook(
  _prev: BookActionState,
  formData: FormData,
): Promise<BookActionState> {
  try {
    const user = await requirePublisher();
    const bookId = String(formData.get("bookId") ?? "");
    const changelog = String(formData.get("changelog") ?? "Published update");

    if (!bookId) {
      return { ok: false, message: "Book ID is required" };
    }

    const book = await assertBookOwner(bookId, user.id);
    const nextVersion = nextPublishedVersion(book.status, book.version);

    const membership = await prisma.membership.findFirst({
      where: { userId: user.id },
      include: { organization: true },
    });
    const organizationId =
      book.organizationId ?? membership?.organizationId ?? null;

    await prisma.$transaction(async (tx) => {
      await tx.book.update({
        where: { id: bookId },
        data: {
          status: BookStatus.PUBLISHED,
          version: nextVersion,
          publishedAt: new Date(),
          organizationId: organizationId ?? undefined,
        },
      });

      await tx.bookVersion.upsert({
        where: {
          bookId_version: { bookId, version: nextVersion },
        },
        create: {
          bookId,
          version: nextVersion,
          changelog,
          publishedBy: user.id,
        },
        update: {
          changelog,
          publishedBy: user.id,
        },
      });

      // Grant student access: org license + class assignment for all org students
      if (organizationId) {
        const existingOrgLicense = await tx.license.findFirst({
          where: {
            bookId,
            scope: "ORGANIZATION",
            organizationId,
            isActive: true,
          },
        });
        if (!existingOrgLicense) {
          await tx.license.create({
            data: {
              bookId,
              scope: "ORGANIZATION",
              organizationId,
              seats: 500,
              seatsUsed: 0,
              isActive: true,
            },
          });
        }

        let klass = await tx.class.findFirst({
          where: { organizationId },
          orderBy: { createdAt: "asc" },
        });

        if (!klass) {
          const instructor =
            (await tx.user.findFirst({
              where: {
                role: "INSTRUCTOR",
                memberships: { some: { organizationId } },
              },
            })) ?? user;

          klass = await tx.class.create({
            data: {
              name: "Open Library",
              description: "Auto-created class for published BookFlow titles",
              organizationId,
              instructorId: instructor.id,
            },
          });
        }

        const students = await tx.user.findMany({
          where: {
            role: "STUDENT",
            memberships: { some: { organizationId } },
          },
          select: { id: true },
        });

        for (const student of students) {
          await tx.enrollment.upsert({
            where: {
              classId_userId: { classId: klass.id, userId: student.id },
            },
            create: { classId: klass.id, userId: student.id },
            update: {},
          });
        }

        const existingAssignment = await tx.assignment.findFirst({
          where: { classId: klass.id, bookId },
        });
        if (!existingAssignment) {
          await tx.assignment.create({
            data: {
              classId: klass.id,
              bookId,
              title: `Read: ${book.title}`,
              description: "Open this book in the PDF reader to get started.",
              dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              createdById: user.id,
            },
          });
        }

        const existingClassLicense = await tx.license.findFirst({
          where: {
            bookId,
            scope: "CLASS",
            classId: klass.id,
            isActive: true,
          },
        });
        if (!existingClassLicense) {
          await tx.license.create({
            data: {
              bookId,
              scope: "CLASS",
              classId: klass.id,
              seats: Math.max(students.length, 40),
              seatsUsed: students.length,
              isActive: true,
            },
          });
        }
      }
    });

    await writeAuditLog({
      userId: user.id,
      action: "book.publish",
      entityType: "Book",
      entityId: bookId,
      metadata: { version: nextVersion, organizationId },
    });

    revalidateBookPaths(bookId);
    revalidatePath("/student");
    revalidatePath("/student/library");
    revalidatePath("/student/assignments");
    revalidatePath("/instructor");
    return {
      ok: true,
      bookId,
      message: organizationId
        ? `Published as version ${nextVersion}. Students in your organization can open it now.`
        : `Published as version ${nextVersion}`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Publish failed",
    };
  }
}

export async function archiveBook(
  _prev: BookActionState,
  formData: FormData,
): Promise<BookActionState> {
  try {
    const user = await requirePublisher();
    const bookId = String(formData.get("bookId") ?? "");
    if (!bookId) {
      return { ok: false, message: "Book ID is required" };
    }

    await assertBookOwner(bookId, user.id);

    await prisma.book.update({
      where: { id: bookId },
      data: { status: BookStatus.ARCHIVED },
    });

    await writeAuditLog({
      userId: user.id,
      action: "book.archive",
      entityType: "Book",
      entityId: bookId,
    });

    revalidateBookPaths(bookId);
    return { ok: true, bookId, message: "Book archived" };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Archive failed",
    };
  }
}

/** Permanently delete a book. Only the owning publisher (main account) can delete. */
export async function deleteBook(
  _prev: BookActionState,
  formData: FormData,
): Promise<BookActionState> {
  try {
    const user = await requirePublisher();
    const bookId = String(formData.get("bookId") ?? "");
    if (!bookId) {
      return { ok: false, message: "Book ID is required" };
    }

    const book = await assertBookOwner(bookId, user.id);
    const storage = getStorage();

    for (const url of [book.fileUrl, book.coverUrl]) {
      if (url?.startsWith("/api/files/")) {
        const key = url.replace(/^\/api\/files\//, "");
        await storage.delete(key).catch(() => undefined);
      }
    }

    await prisma.book.delete({ where: { id: bookId } });

    await writeAuditLog({
      userId: user.id,
      action: "book.delete",
      entityType: "Book",
      entityId: bookId,
      metadata: { title: book.title },
    });

    revalidateBookPaths(bookId);
    revalidatePath("/student");
    revalidatePath("/student/library");
    return { ok: true, bookId, message: "Book deleted" };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Delete failed",
    };
  }
}

export async function saveAsDraft(
  _prev: BookActionState,
  formData: FormData,
): Promise<BookActionState> {
  try {
    const user = await requirePublisher();
    const bookId = String(formData.get("bookId") ?? "");
    if (!bookId) {
      return { ok: false, message: "Book ID is required" };
    }

    await assertBookOwner(bookId, user.id);

    await prisma.book.update({
      where: { id: bookId },
      data: { status: BookStatus.DRAFT },
    });

    await writeAuditLog({
      userId: user.id,
      action: "book.save_draft",
      entityType: "Book",
      entityId: bookId,
    });

    revalidateBookPaths(bookId);
    return { ok: true, bookId, message: "Saved as draft" };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Failed to save draft",
    };
  }
}

export async function saveQuestion(
  _prev: BookActionState,
  formData: FormData,
): Promise<BookActionState> {
  try {
    const user = await requirePublisher();

    let options: z.infer<typeof optionSchema>[] | undefined;
    const rawOptions = formData.get("options");
    if (typeof rawOptions === "string" && rawOptions.trim()) {
      try {
        options = JSON.parse(rawOptions) as z.infer<typeof optionSchema>[];
      } catch {
        return { ok: false, message: "Invalid question options" };
      }
    }

    const parsed = saveQuestionSchema.safeParse({
      bookId: formData.get("bookId"),
      chapterId: formData.get("chapterId"),
      questionId: formData.get("questionId") || undefined,
      type: formData.get("type"),
      prompt: formData.get("prompt"),
      explanation: formData.get("explanation") ?? "",
      feedback: formData.get("feedback") ?? "",
      points: formData.get("points") ?? 1,
      order: formData.get("order") ?? 0,
      correctText: formData.get("correctText") ?? "",
      matchingJson: formData.get("matchingJson") ?? "",
      hotspotJson: formData.get("hotspotJson") ?? "",
      options,
    });

    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Invalid question",
      };
    }

    await assertBookOwner(parsed.data.bookId, user.id);

    const chapter = await prisma.chapter.findFirst({
      where: { id: parsed.data.chapterId, bookId: parsed.data.bookId },
    });
    if (!chapter) {
      return { ok: false, message: "Chapter not found" };
    }

    const type = parsed.data.type as QuestionType;
    const matchingJson = parseJsonField(parsed.data.matchingJson);
    const hotspotJson = parseJsonField(parsed.data.hotspotJson);

    let questionId = parsed.data.questionId;

    if (questionId) {
      await prisma.question.update({
        where: { id: questionId },
        data: {
          type,
          prompt: parsed.data.prompt,
          explanation: parsed.data.explanation ?? "",
          feedback: parsed.data.feedback ?? "",
          points: parsed.data.points ?? 1,
          order: parsed.data.order ?? 0,
          correctText: parsed.data.correctText || null,
          matchingJson,
          hotspotJson,
        },
      });
      await prisma.questionOption.deleteMany({ where: { questionId } });
    } else {
      const created = await prisma.question.create({
        data: {
          chapterId: parsed.data.chapterId,
          type,
          prompt: parsed.data.prompt,
          explanation: parsed.data.explanation ?? "",
          feedback: parsed.data.feedback ?? "",
          points: parsed.data.points ?? 1,
          order: parsed.data.order ?? 0,
          correctText: parsed.data.correctText || null,
          matchingJson,
          hotspotJson,
        },
      });
      questionId = created.id;
    }

    if (parsed.data.options?.length) {
      await prisma.questionOption.createMany({
        data: parsed.data.options.map((opt) => ({
          questionId: questionId!,
          label: opt.label,
          isCorrect: opt.isCorrect,
          order: opt.order,
        })),
      });
    } else if (type === "TRUE_FALSE") {
      await prisma.questionOption.createMany({
        data: [
          { questionId: questionId!, label: "True", isCorrect: true, order: 0 },
          { questionId: questionId!, label: "False", isCorrect: false, order: 1 },
        ],
      });
    }

    await writeAuditLog({
      userId: user.id,
      action: parsed.data.questionId ? "book.update_question" : "book.create_question",
      entityType: "Question",
      entityId: questionId,
      metadata: { bookId: parsed.data.bookId, type },
    });

    revalidateBookPaths(parsed.data.bookId);
    return {
      ok: true,
      bookId: parsed.data.bookId,
      questionId,
      message: "Question saved",
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Failed to save question",
    };
  }
}

export async function saveContentBlock(
  _prev: BookActionState,
  formData: FormData,
): Promise<BookActionState> {
  try {
    const user = await requirePublisher();

    const parsed = saveContentBlockSchema.safeParse({
      bookId: formData.get("bookId"),
      chapterId: formData.get("chapterId"),
      contentBlockId: formData.get("contentBlockId") || undefined,
      type: formData.get("type"),
      title: formData.get("title") ?? "",
      body: formData.get("body") ?? "",
      order: formData.get("order") ?? 0,
      metadataJson: formData.get("metadataJson") ?? "",
    });

    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Invalid content block",
      };
    }

    await assertBookOwner(parsed.data.bookId, user.id);

    const chapter = await prisma.chapter.findFirst({
      where: { id: parsed.data.chapterId, bookId: parsed.data.bookId },
    });
    if (!chapter) {
      return { ok: false, message: "Chapter not found" };
    }

    const type = parsed.data.type as ContentBlockType;
    const metadata = parseJsonField(parsed.data.metadataJson);

    let contentBlockId = parsed.data.contentBlockId;

    if (contentBlockId) {
      await prisma.contentBlock.update({
        where: { id: contentBlockId },
        data: {
          type,
          title: parsed.data.title || null,
          body: parsed.data.body ?? "",
          order: parsed.data.order ?? 0,
          metadata,
        },
      });
    } else {
      const created = await prisma.contentBlock.create({
        data: {
          chapterId: parsed.data.chapterId,
          type,
          title: parsed.data.title || null,
          body: parsed.data.body ?? "",
          order: parsed.data.order ?? 0,
          metadata,
        },
      });
      contentBlockId = created.id;
    }

    await writeAuditLog({
      userId: user.id,
      action: parsed.data.contentBlockId
        ? "book.update_content_block"
        : "book.create_content_block",
      entityType: "ContentBlock",
      entityId: contentBlockId,
      metadata: { bookId: parsed.data.bookId, type },
    });

    revalidateBookPaths(parsed.data.bookId);
    return {
      ok: true,
      bookId: parsed.data.bookId,
      contentBlockId,
      message: "Content block saved",
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Failed to save content block",
    };
  }
}

export async function ensurePlaceholderChapters(bookId: string) {
  const user = await requirePublisher();
  await assertBookOwner(bookId, user.id);

  const count = await prisma.chapter.count({ where: { bookId } });
  if (count > 0) return;

  const placeholders = defaultPlaceholderChapters(4);
  await prisma.chapter.createMany({
    data: placeholders.map((ch) => ({
      bookId,
      title: ch.title,
      order: ch.order,
      content: ch.content,
    })),
  });
}

/** Single-argument wrappers for native form action handlers */
export async function updateBookMetadataForm(formData: FormData): Promise<void> {
  await updateBookMetadata({ ok: false }, formData);
}

export async function publishBookForm(formData: FormData): Promise<void> {
  await publishBook({ ok: false }, formData);
}

export async function archiveBookForm(formData: FormData): Promise<void> {
  await archiveBook({ ok: false }, formData);
}

export async function deleteBookForm(formData: FormData): Promise<void> {
  await deleteBook({ ok: false }, formData);
}

export async function saveAsDraftForm(formData: FormData): Promise<void> {
  await saveAsDraft({ ok: false }, formData);
}
