import type { Question, QuestionOption, QuestionType } from "@prisma/client";

export type AnswerPayload =
  | { type: "MULTIPLE_CHOICE"; optionId: string }
  | { type: "MULTIPLE_ANSWER"; optionIds: string[] }
  | { type: "TRUE_FALSE"; value: boolean }
  | { type: "FILL_BLANK"; text: string }
  | { type: "MATCHING"; pairs: Record<string, string> }
  | { type: "REFLECTION"; text: string };

type QuestionWithOptions = Question & { options: QuestionOption[] };

export function scoreAnswer(
  question: QuestionWithOptions,
  answer: AnswerPayload,
): { isCorrect: boolean; pointsEarned: number } {
  const points = question.points;

  switch (question.type as QuestionType) {
    case "MULTIPLE_CHOICE": {
      if (answer.type !== "MULTIPLE_CHOICE") return { isCorrect: false, pointsEarned: 0 };
      const correct = question.options.find((o) => o.isCorrect);
      const ok = !!correct && correct.id === answer.optionId;
      return { isCorrect: ok, pointsEarned: ok ? points : 0 };
    }
    case "MULTIPLE_ANSWER": {
      if (answer.type !== "MULTIPLE_ANSWER") return { isCorrect: false, pointsEarned: 0 };
      const correctIds = question.options.filter((o) => o.isCorrect).map((o) => o.id).sort();
      const given = [...answer.optionIds].sort();
      const ok =
        correctIds.length === given.length &&
        correctIds.every((id, i) => id === given[i]);
      return { isCorrect: ok, pointsEarned: ok ? points : 0 };
    }
    case "TRUE_FALSE": {
      if (answer.type !== "TRUE_FALSE") return { isCorrect: false, pointsEarned: 0 };
      const correct = question.options.find((o) => o.isCorrect);
      const expected = correct?.label.toLowerCase() === "true";
      const ok = expected === answer.value;
      return { isCorrect: ok, pointsEarned: ok ? points : 0 };
    }
    case "FILL_BLANK": {
      if (answer.type !== "FILL_BLANK") return { isCorrect: false, pointsEarned: 0 };
      const expected = (question.correctText || "").trim().toLowerCase();
      const ok = expected.length > 0 && answer.text.trim().toLowerCase() === expected;
      return { isCorrect: ok, pointsEarned: ok ? points : 0 };
    }
    case "MATCHING": {
      if (answer.type !== "MATCHING") return { isCorrect: false, pointsEarned: 0 };
      const expected = (question.matchingJson || {}) as Record<string, string>;
      const keys = Object.keys(expected);
      const ok =
        keys.length > 0 &&
        keys.every(
          (k) =>
            (answer.pairs[k] || "").trim().toLowerCase() ===
            String(expected[k]).trim().toLowerCase(),
        );
      return { isCorrect: ok, pointsEarned: ok ? points : 0 };
    }
    case "REFLECTION": {
      if (answer.type !== "REFLECTION") return { isCorrect: false, pointsEarned: 0 };
      const ok = answer.text.trim().length >= 10;
      return { isCorrect: ok, pointsEarned: ok ? points : 0 };
    }
    default:
      return { isCorrect: false, pointsEarned: 0 };
  }
}

export function scoreAttempt(
  questions: QuestionWithOptions[],
  answers: Record<string, AnswerPayload>,
) {
  let score = 0;
  let maxScore = 0;
  const details = questions.map((q) => {
    maxScore += q.points;
    const payload = answers[q.id];
    if (!payload) {
      return { questionId: q.id, isCorrect: false, pointsEarned: 0, answer: null };
    }
    const result = scoreAnswer(q, payload);
    score += result.pointsEarned;
    return { questionId: q.id, ...result, answer: payload };
  });
  return { score, maxScore, details };
}
