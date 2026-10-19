export type AIFeature =
  | "chapter_summary"
  | "flashcards"
  | "practice_questions"
  | "ask_book"
  | "next_chapter"
  | "reading_level"
  | "teach_book"
  | "study_guide"
  | "explain";

export interface BookChapterContext {
  title: string;
  order: number;
  content: string;
}

export interface AIRequestContext {
  bookTitle: string;
  author?: string;
  chapterTitle?: string;
  chapterContent?: string;
  /** Plain text from all chapters + extracted PDF (truncated). */
  fullBookText?: string;
  /** Full extracted PDF text (when available). */
  pdfText?: string;
  /** PDF slice focused on the current chapter when detectable. */
  focusedPdfText?: string;
  /** True when we have usable PDF content (text and/or file for Gemini). */
  hasPdfText?: boolean;
  /** Absolute path to the source PDF for multimodal Gemini reads. */
  pdfFilePath?: string;
  /** Base64 PDF bytes when sending the file to Gemini (scanned PDFs). */
  pdfBase64?: string;
  chapters?: BookChapterContext[];
  question?: string;
  targetLevel?: string;
}

export interface AIResponse {
  feature: AIFeature;
  content: string;
  labeled: true;
  requiresReview: true;
  provider: string;
}

export interface AIService {
  generateChapterSummary(ctx: AIRequestContext): Promise<AIResponse>;
  generateFlashcards(ctx: AIRequestContext): Promise<AIResponse>;
  generatePracticeQuestions(ctx: AIRequestContext): Promise<AIResponse>;
  askBook(ctx: AIRequestContext): Promise<AIResponse>;
  recommendNextChapter(ctx: AIRequestContext): Promise<AIResponse>;
  adjustReadingLevel(ctx: AIRequestContext): Promise<AIResponse>;
  teachWholeBook(ctx: AIRequestContext): Promise<AIResponse>;
  generateStudyGuide(ctx: AIRequestContext): Promise<AIResponse>;
  explainConcept(ctx: AIRequestContext): Promise<AIResponse>;
}
