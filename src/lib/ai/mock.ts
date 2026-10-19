import type { AIFeature, AIRequestContext, AIResponse, AIService } from "./types";
import { findRelevantSnippets } from "./context";

function wrap(feature: AIFeature, content: string): AIResponse {
  return {
    feature,
    content,
    labeled: true,
    requiresReview: true,
    provider: "mock-tutor",
  };
}

function chapterOutline(ctx: AIRequestContext) {
  if (!ctx.chapters?.length) {
    return ["Introduction", "Core ideas", "Practice and review"];
  }
  return ctx.chapters.map((c) => c.title);
}

function groundedAnswer(ctx: AIRequestContext, question: string) {
  const source =
    ctx.focusedPdfText ||
    ctx.pdfText ||
    ctx.fullBookText ||
    ctx.chapterContent ||
    "";
  const snippets = findRelevantSnippets(source, question, 4);
  if (snippets.length === 0) {
    return (
      `I do not have enough extracted text from “${ctx.bookTitle}” yet. ` +
      `Open the PDF in BookFlow and try again, or ask a more specific question about a chapter topic.`
    );
  }

  return [
    `Tutor answer for “${ctx.bookTitle}”`,
    "",
    `Question: ${question}`,
    "",
    "Here is a clear explanation grounded in the book:",
    "",
    `1. Main idea: ${snippets[0]}`,
    snippets[1] ? `2. Supporting detail: ${snippets[1]}` : "",
    snippets[2] ? `3. Another point: ${snippets[2]}` : "",
    "",
    "How to remember it:",
    "- Restate the main idea in your own words",
    "- Connect it to an example from the chapter",
    "- Check yourself with a practice question",
    "",
    "Evidence from the book:",
    ...snippets.map((s, i) => `• (${i + 1}) ${s}`),
  ]
    .filter(Boolean)
    .join("\n");
}

export class MockAIService implements AIService {
  async generateChapterSummary(ctx: AIRequestContext): Promise<AIResponse> {
    const title = ctx.chapterTitle ?? "this section";
    const snippets = findRelevantSnippets(
      ctx.chapterContent || ctx.fullBookText || "",
      title,
      4,
    );
    const body =
      snippets.length > 0
        ? snippets.map((s, i) => `${i + 1}. ${s}`).join("\n")
        : "This section introduces key ideas and prepares you for practice activities.";

    return wrap(
      "chapter_summary",
      [
        `Chapter summary — ${title}`,
        `Book: ${ctx.bookTitle}`,
        "",
        body,
        "",
        "Learning check:",
        "- Can you name the 2–3 most important ideas?",
        "- What should you practice next?",
      ].join("\n"),
    );
  }

  async generateFlashcards(ctx: AIRequestContext): Promise<AIResponse> {
    const source =
      ctx.focusedPdfText ||
      ctx.pdfText ||
      ctx.chapterContent ||
      ctx.fullBookText ||
      ctx.bookTitle;
    const snippets = findRelevantSnippets(
      source,
      ctx.question || ctx.chapterTitle || ctx.bookTitle,
      5,
    );
    const cards = snippets.slice(0, 5).map((s, i) => ({
      front: `Card ${i + 1}: What does this mean in ${ctx.bookTitle}?`,
      back: s,
    }));
    if (cards.length === 0) {
      cards.push(
        {
          front: `What is “${ctx.bookTitle}” about?`,
          back: "Review the opening chapter for the main theme.",
        },
        {
          front: "How should you study this PDF?",
          back: "Read, ask the tutor, make flashcards, then practice questions.",
        },
      );
    }
    return wrap(
      "flashcards",
      JSON.stringify({
        title: `Flashcards — ${ctx.chapterTitle || ctx.bookTitle}`,
        cards: cards.map((c) => ({ front: c.front, back: c.back })),
      }),
    );
  }

  async generatePracticeQuestions(ctx: AIRequestContext): Promise<AIResponse> {
    const outline = chapterOutline(ctx);
    const topic = ctx.chapterTitle || outline[0] || ctx.bookTitle;
    const source =
      ctx.focusedPdfText ||
      ctx.pdfText ||
      ctx.fullBookText ||
      ctx.chapterContent ||
      "";
    const snippets = findRelevantSnippets(
      source,
      ctx.question || topic,
      3,
    );

    return wrap(
      "practice_questions",
      JSON.stringify({
        title: `Practice quiz — ${topic}`,
        questions: [
          {
            id: "q1",
            type: "mcq",
            prompt: `What is a key idea from “${topic}”?`,
            options: [
              snippets[0]?.slice(0, 90) || "The chapter’s main concept",
              "A random unrelated fact",
              "Skipping the reading entirely",
              "Ignoring practice activities",
            ],
            answer: snippets[0]?.slice(0, 90) || "The chapter’s main concept",
            explanation: "Grounded in the chapter focus.",
          },
          {
            id: "q2",
            type: "true_false",
            prompt:
              "Reviewing AI answers against the PDF improves understanding.",
            options: ["True", "False"],
            answer: "True",
            explanation: "Always verify AI tutoring against the source text.",
          },
          {
            id: "q3",
            type: "short",
            prompt: `In your own words, explain one idea from “${topic}”.`,
            answer: snippets[1] || "Use a concrete example from the text.",
            explanation: "Look for a concrete example in the chapter.",
          },
          {
            id: "q4",
            type: "mcq",
            prompt: `How should you study “${topic}”?`,
            options: [
              "Read, ask the tutor, make flashcards, then practice",
              "Memorize random facts only",
              "Skip the PDF entirely",
              "Only highlight once",
            ],
            answer: "Read, ask the tutor, make flashcards, then practice",
          },
        ],
      }),
    );
  }

  async askBook(ctx: AIRequestContext): Promise<AIResponse> {
    const question =
      ctx.question?.trim() ||
      "What are the most important ideas I should learn from this book?";
    return wrap("ask_book", groundedAnswer(ctx, question));
  }

  async recommendNextChapter(ctx: AIRequestContext): Promise<AIResponse> {
    const outline = chapterOutline(ctx);
    const current = ctx.chapterTitle;
    const idx = outline.findIndex((t) => t === current);
    const next =
      idx >= 0 && idx < outline.length - 1
        ? outline[idx + 1]
        : outline[Math.min(1, outline.length - 1)] || "the next section";

    return wrap(
      "next_chapter",
      [
        "Recommended next step",
        "",
        `You are in: ${current || "the current section"}`,
        `Next: ${next}`,
        "",
        "Study plan for the next 15 minutes:",
        `1. Skim “${next}” headings`,
        "2. Ask the tutor to explain any confusing sentence",
        "3. Do 2 practice questions",
        "4. Write one sentence summary in Notes",
      ].join("\n"),
    );
  }

  async adjustReadingLevel(ctx: AIRequestContext): Promise<AIResponse> {
    const level = ctx.targetLevel || "simpler";
    const source =
      ctx.chapterContent?.slice(0, 700) ||
      findRelevantSnippets(ctx.fullBookText || "", ctx.bookTitle, 2).join(" ");

    return wrap(
      "reading_level",
      [
        `Easier explanation (${level}) — AI-generated, review required`,
        `Book: ${ctx.bookTitle}`,
        `Section: ${ctx.chapterTitle || "Whole book"}`,
        "",
        "In simpler words:",
        source
          ? `This part of the book is saying: ${source}`
          : "This part of the book introduces an important idea and then shows how to use it.",
        "",
        "Tiny example:",
        "If the book explains a concept, first name it, then say why it matters, then give one example from your own life.",
        "",
        "Quick check:",
        "Can you explain it to a friend in two sentences?",
      ].join("\n"),
    );
  }

  async teachWholeBook(ctx: AIRequestContext): Promise<AIResponse> {
    const outline = chapterOutline(ctx);
    const snippets = findRelevantSnippets(
      ctx.fullBookText || "",
      ctx.bookTitle,
      6,
    );

    const lessons = outline.slice(0, 8).map((title, i) => {
      const tip = snippets[i] || `Focus on the main idea and one example in “${title}”.`;
      return [
        `Lesson ${i + 1}: ${title}`,
        `Goal: Understand the core idea of “${title}”.`,
        `Teach point: ${tip}`,
        "Try this: Write a 1-sentence summary, then ask the tutor one question.",
      ].join("\n");
    });

    return wrap(
      "teach_book",
      [
        `Tutor mode — teach the whole PDF`,
        `Book: ${ctx.bookTitle}${ctx.author ? ` by ${ctx.author}` : ""}`,
        "",
        "I can walk you through the entire book like a teacher:",
        "",
        ...lessons,
        "",
        "Suggested path:",
        "1) Start Lesson 1",
        "2) Ask me to explain anything confusing",
        "3) Use Flashcards + Practice Qs after every 2 lessons",
        "4) Finish with Study guide for exam review",
        "",
        "Ask me things like:",
        "- “Teach lesson 2 more slowly”",
        "- “Give me examples for this topic”",
        "- “Quiz me on the whole book”",
      ].join("\n"),
    );
  }

  async generateStudyGuide(ctx: AIRequestContext): Promise<AIResponse> {
    const outline = chapterOutline(ctx);
    const snippets = findRelevantSnippets(
      ctx.fullBookText || "",
      "important key concept definition",
      5,
    );

    return wrap(
      "study_guide",
      [
        `Complete study guide — ${ctx.bookTitle}`,
        "",
        "A. Chapter map",
        ...outline.map((t, i) => `${i + 1}. ${t}`),
        "",
        "B. Must-know ideas",
        ...snippets.map((s, i) => `${i + 1}. ${s}`),
        "",
        "C. Exam checklist",
        "- Define each key term in your own words",
        "- Give one example for each major idea",
        "- Answer 5 practice questions without notes",
        "- Re-read only the sections you missed",
        "",
        "D. 45-minute revision plan",
        "0–10 min: Skim chapter map",
        "10–25 min: Flashcards",
        "25–40 min: Practice questions",
        "40–45 min: Write a final summary paragraph",
      ].join("\n"),
    );
  }

  async explainConcept(ctx: AIRequestContext): Promise<AIResponse> {
    const concept =
      ctx.question?.trim() ||
      ctx.chapterTitle ||
      "the main concept in this section";
    return wrap(
      "explain",
      groundedAnswer(ctx, `Explain “${concept}” like a patient teacher with examples.`),
    );
  }
}
