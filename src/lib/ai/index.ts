import { MockAIService } from "./mock";
import { GeminiAIService } from "./gemini";
import { GeminiWithMockBackup } from "./fallback";
import type { AIService } from "./types";

let service: AIService | null = null;

export function getAIService(): AIService {
  if (!service) {
    const provider = (process.env.AI_PROVIDER || "auto").toLowerCase();
    const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
    const mock = new MockAIService();

    // Gemini when configured; mock remains the backup if Gemini errors.
    // No UI changes — same AIService interface used by existing pages.
    if (
      hasGemini &&
      (provider === "gemini" || provider === "auto" || provider === "backup")
    ) {
      service = new GeminiWithMockBackup(new GeminiAIService(), mock);
    } else {
      if (provider === "gemini" && !hasGemini) {
        console.warn("AI_PROVIDER=gemini but GEMINI_API_KEY is missing; using mock.");
      }
      service = mock;
    }
  }
  return service;
}

export type {
  AIService,
  AIResponse,
  AIFeature,
  AIRequestContext,
  BookChapterContext,
} from "./types";
