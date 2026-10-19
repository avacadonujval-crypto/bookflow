import type {
  StudyFlashcard,
  StudyFlashcardDeck,
  StudyQuiz,
  StudyQuizQuestion,
} from "./study-types";

function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // fall through
    }
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  return null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseFlashcardDeck(
  content: string,
  fallbackTitle = "Flashcards",
): StudyFlashcardDeck {
  const json = extractJsonObject(content);
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    const rawCards = Array.isArray(obj.cards)
      ? obj.cards
      : Array.isArray(obj.flashcards)
        ? obj.flashcards
        : [];
    const cards: StudyFlashcard[] = rawCards
      .map((card) => {
        if (!card || typeof card !== "object") return null;
        const c = card as Record<string, unknown>;
        const front = asString(c.front ?? c.q ?? c.question);
        const back = asString(c.back ?? c.a ?? c.answer);
        if (!front || !back) return null;
        return { front, back };
      })
      .filter((c): c is StudyFlashcard => Boolean(c));

    if (cards.length > 0) {
      return {
        title: asString(obj.title) || fallbackTitle,
        cards,
      };
    }
  }

  // Plain-text fallback: Card N / Q: / A:
  const cards: StudyFlashcard[] = [];
  const blocks = content.split(/Card\s*\d+/i).slice(1);
  for (const block of blocks) {
    const q =
      block.match(/Q:\s*([\s\S]*?)(?:\n\s*A:|$)/i)?.[1]?.trim() ||
      block.match(/Front:\s*([\s\S]*?)(?:\n\s*(?:Back|A):|$)/i)?.[1]?.trim();
    const a =
      block.match(/A:\s*([\s\S]*?)(?:\n\s*Card\s*\d+|$)/i)?.[1]?.trim() ||
      block.match(/Back:\s*([\s\S]*?)(?:\n\s*Card\s*\d+|$)/i)?.[1]?.trim();
    if (q && a) cards.push({ front: q, back: a });
  }

  if (cards.length === 0) {
    // Last resort: pair lines
    const lines = content
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    for (let i = 0; i < lines.length - 1; i += 1) {
      if (/^Q[:.]/i.test(lines[i]) && /^A[:.]/i.test(lines[i + 1])) {
        cards.push({
          front: lines[i].replace(/^Q[:.]\s*/i, ""),
          back: lines[i + 1].replace(/^A[:.]\s*/i, ""),
        });
        i += 1;
      }
    }
  }

  return {
    title: fallbackTitle,
    cards:
      cards.length > 0
        ? cards
        : [
            {
              front: "No flashcards were generated",
              back: "Try again, or ask a more specific topic from the chapter.",
            },
          ],
  };
}

export function parsePracticeQuiz(
  content: string,
  fallbackTitle = "Practice quiz",
): StudyQuiz {
  const json = extractJsonObject(content);
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    const raw = Array.isArray(obj.questions) ? obj.questions : [];
    const questions: StudyQuizQuestion[] = [];
    raw.forEach((q, index) => {
      if (!q || typeof q !== "object") return;
      const item = q as Record<string, unknown>;
      const typeRaw = asString(item.type).toLowerCase();
      const type: StudyQuizQuestion["type"] =
        typeRaw.includes("true") || typeRaw === "tf"
          ? "true_false"
          : typeRaw.includes("short")
            ? "short"
            : "mcq";
      const prompt = asString(item.prompt ?? item.question);
      const answer = asString(item.answer ?? item.correct);
      if (!prompt || !answer) return;
      const question: StudyQuizQuestion = {
        id: asString(item.id) || `q-${index + 1}`,
        type,
        prompt,
        answer,
      };
      if (Array.isArray(item.options)) {
        question.options = item.options.map((o) => String(o)).filter(Boolean);
      } else if (type === "true_false") {
        question.options = ["True", "False"];
      }
      const explanation = asString(item.explanation);
      if (explanation) question.explanation = explanation;
      questions.push(question);
    });

    if (questions.length > 0) {
      return {
        title: asString(obj.title) || fallbackTitle,
        questions,
      };
    }
  }

  // Minimal text fallback — one short question from the blob
  return {
    title: fallbackTitle,
    questions: [
      {
        id: "q-1",
        type: "short",
        prompt:
          "Based on the generated quiz text, summarize one key idea you should remember.",
        answer: content.slice(0, 280) || "Review the chapter and try generating again.",
        explanation: "Parsed from free-form AI output.",
      },
    ],
  };
}
