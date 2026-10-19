import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import type { AIRequestContext } from "./types";

const MAX_PDF_BYTES_FOR_GEMINI = 18 * 1024 * 1024; // ~18MB inline limit safety

function truncate(text: string, max = 120000) {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[…truncated for AI context…]`;
}

function resolvePdfPath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  if (fileUrl.startsWith("/api/files/")) {
    const key = decodeURIComponent(fileUrl.replace(/^\/api\/files\//, ""));
    return path.join(process.cwd(), "uploads", key);
  }
  if (fileUrl.startsWith("/sample/")) {
    return path.join(process.cwd(), "public", fileUrl.replace(/^\//, ""));
  }
  return null;
}

async function loadPdfBuffer(
  fileUrl: string | null | undefined,
): Promise<{ buffer: Buffer; filePath: string | null } | null> {
  if (!fileUrl) return null;

  // Remote / Blob URLs (production)
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      return { buffer: Buffer.from(ab), filePath: null };
    } catch {
      return null;
    }
  }

  const filePath = resolvePdfPath(fileUrl);
  if (!filePath) return null;
  try {
    const buffer = await readFile(/* turbopackIgnore: true */ filePath);
    return { buffer, filePath };
  } catch {
    return null;
  }
}

/** True when extracted text has real words (not just page markers). */
function isUsableExtractedText(text: string) {
  const cleaned = text
    .replace(/\[PDF page \d+\]/gi, " ")
    .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const letters = cleaned.replace(/[^a-zA-Z]/g, "");
  return letters.length >= 120;
}

type PdfExtraction = {
  fullText: string;
  pages: Array<{ page: number; text: string }>;
  filePath: string | null;
  base64: string | null;
};

async function extractPdf(
  fileUrl: string | null | undefined,
): Promise<PdfExtraction> {
  const loaded = await loadPdfBuffer(fileUrl);
  if (!loaded) {
    return { fullText: "", pages: [], filePath: null, base64: null };
  }

  const { buffer, filePath } = loaded;

  try {
    const base64 =
      buffer.byteLength > 0 && buffer.byteLength <= MAX_PDF_BYTES_FOR_GEMINI
        ? buffer.toString("base64")
        : null;

    const pdfParseMod = (await import("pdf-parse")) as unknown as {
      PDFParse: new (opts: { data: Buffer | Uint8Array }) => {
        getText: () => Promise<{
          text?: string;
          pages?: Array<{ num?: number; text?: string }>;
        }>;
        destroy: () => Promise<void>;
      };
    };
    const { PDFParse } = pdfParseMod;

    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      const pages = (parsed.pages || [])
        .map((p, i) => ({
          page: p.num ?? i + 1,
          text: (p.text || "").replace(/\s+/g, " ").trim(),
        }))
        .filter((p) => p.text.length > 0);

      const fullText =
        pages.length > 0
          ? pages.map((p) => `[PDF page ${p.page}]\n${p.text}`).join("\n\n")
          : (parsed.text || "").replace(/\s+/g, " ").trim();

      return { fullText, pages, filePath, base64 };
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  } catch (error) {
    console.warn("[BookFlow AI] PDF load/extraction failed:", error);
    return { fullText: "", pages: [], filePath, base64: null };
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build AI context from the book PDF when available.
 * Falls back to chapter text so demo/sample titles still tutor correctly.
 */
export async function buildBookAIContext(params: {
  bookId: string;
  chapterId?: string;
  question?: string;
  targetLevel?: string;
}): Promise<AIRequestContext | null> {
  const book = await prisma.book.findUnique({
    where: { id: params.bookId },
    select: {
      id: true,
      title: true,
      author: true,
      description: true,
      fileUrl: true,
      chapters: {
        orderBy: { order: "asc" },
        select: { id: true, title: true, content: true, order: true },
      },
    },
  });
  if (!book) return null;

  const pdf = await extractPdf(book.fileUrl);
  const usablePdfText = isUsableExtractedText(pdf.fullText);
  const hasPdfFile = Boolean(pdf.base64);

  const chapterPlain = book.chapters
    .map(
      (c) =>
        `## Chapter ${c.order}: ${c.title}\n${stripHtml(c.content || "")}`,
    )
    .join("\n\n")
    .trim();
  const usableChapterText = isUsableExtractedText(chapterPlain);

  const bodyText = usablePdfText
    ? pdf.fullText
    : usableChapterText
      ? chapterPlain
      : "";
  const hasPdfText = Boolean(bodyText) || hasPdfFile;

  const sourceLabel = usablePdfText
    ? "Source: extracted PDF text."
    : hasPdfFile
      ? "Source: PDF file attached for Gemini (scanned/image PDF — little plain text extracted)."
      : usableChapterText
        ? "Source: chapter text (PDF text unavailable)."
        : "Source: no readable book content.";

  const fullBookText = truncate(
    [
      `Book: ${book.title}`,
      book.author ? `Author: ${book.author}` : "",
      book.description ? `Description: ${book.description}` : "",
      sourceLabel,
      "",
      "# Book content",
      bodyText ||
        (hasPdfFile
          ? "(Plain-text extraction was empty or too thin. Read the attached PDF file directly.)"
          : "No readable content available for this book."),
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const focusedChapter = params.chapterId
    ? book.chapters.find((c) => c.id === params.chapterId)
    : book.chapters[0];

  return {
    bookTitle: book.title,
    author: book.author ?? undefined,
    chapterTitle: focusedChapter?.title ?? book.title,
    chapterContent: focusedChapter
      ? stripHtml(focusedChapter.content || "")
      : bodyText,
    chapters: book.chapters.map((c) => ({
      title: c.title,
      order: c.order,
      content: stripHtml(c.content || ""),
    })),
    fullBookText,
    pdfText: bodyText,
    focusedPdfText: bodyText,
    hasPdfText,
    pdfFilePath: pdf.filePath ?? undefined,
    pdfBase64: pdf.base64 ?? undefined,
    question: params.question,
    targetLevel: params.targetLevel,
  };
}

/** Pull short grounded snippets from book text for mock tutoring answers. */
export function findRelevantSnippets(fullText: string, query: string, limit = 3) {
  if (!fullText.trim()) return [] as string[];
  const sentences = fullText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40 && s.length < 320);

  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 3);

  const scored = sentences.map((sentence) => {
    const lower = sentence.toLowerCase();
    const score = terms.reduce(
      (sum, term) => sum + (lower.includes(term) ? 1 : 0),
      0,
    );
    return { sentence, score };
  });

  const matched = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.sentence);

  if (matched.length > 0) return matched;
  return sentences.slice(0, Math.min(limit, sentences.length));
}
