import type { AIRequestContext, AIResponse, AIService } from "./types";

type FeatureMethod = keyof AIService;

async function runWithBackup(
  primary: AIService,
  backup: AIService,
  method: FeatureMethod,
  ctx: AIRequestContext,
): Promise<AIResponse> {
  try {
    return await primary[method](ctx);
  } catch (error) {
    console.warn(
      `[BookFlow AI] Primary provider failed on ${String(method)}; using backup.`,
      error instanceof Error ? error.message : error,
    );
    const response = await backup[method](ctx);
    return {
      ...response,
      content: `${response.content}\n\n(Note: Gemini backup was unavailable, so a local tutor response was used.)`,
    };
  }
}

/** Tries Gemini first; falls back to mock if Gemini fails. */
export class GeminiWithMockBackup implements AIService {
  constructor(
    private readonly gemini: AIService,
    private readonly mock: AIService,
  ) {}

  generateChapterSummary(ctx: AIRequestContext) {
    return runWithBackup(this.gemini, this.mock, "generateChapterSummary", ctx);
  }
  generateFlashcards(ctx: AIRequestContext) {
    return runWithBackup(this.gemini, this.mock, "generateFlashcards", ctx);
  }
  generatePracticeQuestions(ctx: AIRequestContext) {
    return runWithBackup(
      this.gemini,
      this.mock,
      "generatePracticeQuestions",
      ctx,
    );
  }
  askBook(ctx: AIRequestContext) {
    return runWithBackup(this.gemini, this.mock, "askBook", ctx);
  }
  recommendNextChapter(ctx: AIRequestContext) {
    return runWithBackup(this.gemini, this.mock, "recommendNextChapter", ctx);
  }
  adjustReadingLevel(ctx: AIRequestContext) {
    return runWithBackup(this.gemini, this.mock, "adjustReadingLevel", ctx);
  }
  teachWholeBook(ctx: AIRequestContext) {
    return runWithBackup(this.gemini, this.mock, "teachWholeBook", ctx);
  }
  generateStudyGuide(ctx: AIRequestContext) {
    return runWithBackup(this.gemini, this.mock, "generateStudyGuide", ctx);
  }
  explainConcept(ctx: AIRequestContext) {
    return runWithBackup(this.gemini, this.mock, "explainConcept", ctx);
  }
}
