import type {
  AIFeature,
  AIRequestContext,
  AIResponse,
  AIService,
} from "./types";

const DEFAULT_MODELS = [
  process.env.GEMINI_MODEL?.trim(),
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
].filter((m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i);

function wrap(feature: AIFeature, content: string): AIResponse {
  return {
    feature,
    content: content.trim(),
    labeled: true,
    requiresReview: true,
    provider: "gemini",
  };
}

function buildSystemPrompt(feature: AIFeature) {
  const base = [
    "You are BookFlow's AI reading tutor for students.",
    "Your job is to help the student understand the attached PDF.",
    "CRITICAL: Use ONLY facts from the PDF (attached file and/or extracted text).",
    "There are no separate app chapters — ignore chapter databases. Use the PDF only.",
    "Do NOT invent outside facts. Do NOT say content is missing because a chapter is missing.",
    "If a PDF file is attached, READ THE PDF FILE even when plain-text extraction is empty (scanned books).",
    "Always produce helpful study material from the PDF when the file is present.",
    "Be clear, structured, and educational.",
    `Current task: ${feature.replace(/_/g, " ")}.`,
  ];
  if (feature === "flashcards" || feature === "practice_questions") {
    base.push("Return JSON only. Do not add any prose outside the JSON object.");
  } else {
    base.push(
      "End with a one-line note that this is AI-generated tutoring help grounded in the PDF.",
    );
  }
  return base.join(" ");
}

function buildUserPrompt(feature: AIFeature, ctx: AIRequestContext) {
  const extracted = (ctx.pdfText || "").trim();
  const parts = [
    `Book: ${ctx.bookTitle}`,
    ctx.author ? `Author: ${ctx.author}` : "",
    ctx.pdfBase64
      ? "A PDF file is attached below — read that PDF as the primary source."
      : extracted
        ? "Use the extracted PDF text below as the primary source."
        : "No PDF content available.",
    ctx.targetLevel ? `Reading level target: ${ctx.targetLevel}` : "",
    ctx.question ? `Student request: ${ctx.question}` : "",
    "",
  ];

  if (extracted) {
    parts.push(
      "Extracted PDF text (may be incomplete for scanned PDFs):",
      extracted.slice(0, 100000),
      "",
    );
  } else if (ctx.pdfBase64) {
    parts.push(
      "Plain-text extraction was empty/thin. Rely entirely on the attached PDF file.",
      "",
    );
  }

  switch (feature) {
    case "teach_book":
      parts.push(
        "Teach the whole PDF so a student understands it.",
        "Include: overview, section-by-section walkthrough, key concepts,",
        "short comprehension checks with answers from the PDF, and a study schedule.",
      );
      break;
    case "study_guide":
      parts.push(
        "Build a study guide from ONLY this PDF: section map, must-know ideas, definitions,",
        "exam checklist, and a timed revision plan.",
      );
      break;
    case "explain":
      parts.push(
        "Explain the requested idea (or the main ideas of the PDF) using only the PDF.",
        "Include a plain-language explanation, 2–3 points from the PDF, and a short recap.",
      );
      break;
    case "chapter_summary":
      parts.push(
        "Summarize this PDF to help the student understand it better.",
        "Include purpose, key points, important terms, what to remember,",
        "and 3 quick check questions WITH answers taken from the PDF.",
      );
      break;
    case "flashcards":
      parts.push(
        "Read the PDF thoroughly, then create 8–12 flashcards that help the student understand it.",
        "EVERY question and EVERY answer must come from the PDF. Never mention missing chapters.",
        "If the student named a topic, stay on that topic inside the PDF.",
        "Return ONLY valid JSON:",
        '{"title":"string","cards":[{"front":"question","back":"answer from PDF"}]}',
        "No markdown fences.",
      );
      break;
    case "practice_questions":
      parts.push(
        "Read the PDF thoroughly, then create a practice quiz from it.",
        "EVERY question, correct answer, and explanation must come from the PDF. Never mention missing chapters.",
        "Create: 4 mcq, 2 true_false, 2 short.",
        "Return ONLY valid JSON:",
        '{"title":"string","questions":[{"id":"q1","type":"mcq|true_false|short","prompt":"...","options":["A","B","C","D"],"answer":"...","explanation":"..."}]}',
        'For true_false use options ["True","False"]. For short use options [].',
        "No markdown fences.",
      );
      break;
    case "ask_book":
      parts.push(
        "Answer using ONLY the PDF. Help the student understand the material better.",
        "Structure: direct answer → supporting points from the PDF → short study tip.",
      );
      break;
    case "next_chapter":
      parts.push(
        "Based only on the PDF structure, recommend what to study next and a 15-minute plan.",
      );
      break;
    case "reading_level":
      parts.push(
        "Rewrite the main PDF ideas (or requested topic) in simpler language without adding new facts.",
      );
      break;
  }

  return parts.filter(Boolean).join("\n");
}

function wantsJson(feature: AIFeature) {
  return feature === "flashcards" || feature === "practice_questions";
}

async function callGeminiOnce(
  model: string,
  apiKey: string,
  feature: AIFeature,
  ctx: AIRequestContext,
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const generationConfig: Record<string, unknown> = {
    temperature: 0.4,
    maxOutputTokens: 8192,
  };
  if (wantsJson(feature)) {
    generationConfig.responseMimeType = "application/json";
  }

  const userParts: Array<Record<string, unknown>> = [];
  // Attach the real PDF so Gemini can read scanned / image-based books.
  if (ctx.pdfBase64) {
    userParts.push({
      inlineData: {
        mimeType: "application/pdf",
        data: ctx.pdfBase64,
      },
    });
  }
  userParts.push({ text: buildUserPrompt(feature, ctx) });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: buildSystemPrompt(feature) }],
      },
      contents: [
        {
          role: "user",
          parts: userParts,
        },
      ],
      generationConfig,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status} (${model}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("\n")
    .trim();

  if (!text) {
    throw new Error(`Gemini returned an empty response (${model})`);
  }

  return wrap(feature, text);
}

async function callGemini(feature: AIFeature, ctx: AIRequestContext) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  let lastError: unknown;
  for (const model of DEFAULT_MODELS) {
    try {
      return await callGeminiOnce(model, apiKey, feature, ctx);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      // Try next model on not-found / unsupported model; otherwise stop.
      if (!/404|not found|NOT_FOUND/i.test(message)) {
        throw error;
      }
      console.warn(`[BookFlow AI] Model ${model} unavailable, trying fallback…`);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All Gemini models failed");
}

export class GeminiAIService implements AIService {
  generateChapterSummary(ctx: AIRequestContext) {
    return callGemini("chapter_summary", ctx);
  }
  generateFlashcards(ctx: AIRequestContext) {
    return callGemini("flashcards", ctx);
  }
  generatePracticeQuestions(ctx: AIRequestContext) {
    return callGemini("practice_questions", ctx);
  }
  askBook(ctx: AIRequestContext) {
    return callGemini("ask_book", ctx);
  }
  recommendNextChapter(ctx: AIRequestContext) {
    return callGemini("next_chapter", ctx);
  }
  adjustReadingLevel(ctx: AIRequestContext) {
    return callGemini("reading_level", ctx);
  }
  teachWholeBook(ctx: AIRequestContext) {
    return callGemini("teach_book", ctx);
  }
  generateStudyGuide(ctx: AIRequestContext) {
    return callGemini("study_guide", ctx);
  }
  explainConcept(ctx: AIRequestContext) {
    return callGemini("explain", ctx);
  }
}
