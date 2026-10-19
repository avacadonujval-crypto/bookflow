import { describe, expect, it } from "vitest";
import type { Question, QuestionOption } from "@prisma/client";
import { scoreAnswer, scoreAttempt } from "@/lib/services/quiz";

type Q = Question & { options: QuestionOption[] };

function baseQuestion(overrides: Partial<Q> & Pick<Q, "type">): Q {
  return {
    id: "q1",
    chapterId: "ch1",
    prompt: "Test",
    explanation: "",
    feedback: "",
    points: 2,
    order: 0,
    correctText: null,
    matchingJson: null,
    hotspotJson: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    options: [],
    ...overrides,
  };
}

describe("scoreAnswer", () => {
  it("scores multiple choice correctly", () => {
    const q = baseQuestion({
      type: "MULTIPLE_CHOICE",
      options: [
        { id: "a", questionId: "q1", label: "Wrong", isCorrect: false, order: 0 },
        { id: "b", questionId: "q1", label: "Right", isCorrect: true, order: 1 },
      ],
    });
    expect(scoreAnswer(q, { type: "MULTIPLE_CHOICE", optionId: "b" })).toEqual({
      isCorrect: true,
      pointsEarned: 2,
    });
    expect(scoreAnswer(q, { type: "MULTIPLE_CHOICE", optionId: "a" })).toEqual({
      isCorrect: false,
      pointsEarned: 0,
    });
  });

  it("scores multiple answer when all correct options match", () => {
    const q = baseQuestion({
      type: "MULTIPLE_ANSWER",
      options: [
        { id: "a", questionId: "q1", label: "A", isCorrect: true, order: 0 },
        { id: "b", questionId: "q1", label: "B", isCorrect: true, order: 1 },
        { id: "c", questionId: "q1", label: "C", isCorrect: false, order: 2 },
      ],
    });
    expect(
      scoreAnswer(q, { type: "MULTIPLE_ANSWER", optionIds: ["b", "a"] }),
    ).toEqual({ isCorrect: true, pointsEarned: 2 });
    expect(
      scoreAnswer(q, { type: "MULTIPLE_ANSWER", optionIds: ["a"] }),
    ).toEqual({ isCorrect: false, pointsEarned: 0 });
  });

  it("scores true/false from correct option label", () => {
    const q = baseQuestion({
      type: "TRUE_FALSE",
      options: [
        { id: "t", questionId: "q1", label: "True", isCorrect: true, order: 0 },
        { id: "f", questionId: "q1", label: "False", isCorrect: false, order: 1 },
      ],
    });
    expect(scoreAnswer(q, { type: "TRUE_FALSE", value: true })).toEqual({
      isCorrect: true,
      pointsEarned: 2,
    });
    expect(scoreAnswer(q, { type: "TRUE_FALSE", value: false })).toEqual({
      isCorrect: false,
      pointsEarned: 0,
    });
  });

  it("scores fill blank case-insensitively", () => {
    const q = baseQuestion({
      type: "FILL_BLANK",
      correctText: "Struggle",
    });
    expect(scoreAnswer(q, { type: "FILL_BLANK", text: " struggle " })).toEqual({
      isCorrect: true,
      pointsEarned: 2,
    });
  });

  it("scores matching pairs", () => {
    const q = baseQuestion({
      type: "MATCHING",
      matchingJson: { Term: "Definition" },
    });
    expect(
      scoreAnswer(q, {
        type: "MATCHING",
        pairs: { Term: "definition" },
      }),
    ).toEqual({ isCorrect: true, pointsEarned: 2 });
  });

  it("scores reflection when text is long enough", () => {
    const q = baseQuestion({ type: "REFLECTION" });
    expect(
      scoreAnswer(q, { type: "REFLECTION", text: "short" }),
    ).toEqual({ isCorrect: false, pointsEarned: 0 });
    expect(
      scoreAnswer(q, {
        type: "REFLECTION",
        text: "This is my reflection habit.",
      }),
    ).toEqual({ isCorrect: true, pointsEarned: 2 });
  });

  it("returns zero when answer type mismatches question type", () => {
    const q = baseQuestion({ type: "MULTIPLE_CHOICE", options: [] });
    expect(scoreAnswer(q, { type: "TRUE_FALSE", value: true })).toEqual({
      isCorrect: false,
      pointsEarned: 0,
    });
  });
});

describe("scoreAttempt", () => {
  it("aggregates score and marks missing answers incorrect", () => {
    const questions: Q[] = [
      baseQuestion({
        id: "q1",
        type: "MULTIPLE_CHOICE",
        points: 1,
        options: [
          { id: "ok", questionId: "q1", label: "Yes", isCorrect: true, order: 0 },
        ],
      }),
      baseQuestion({
        id: "q2",
        type: "FILL_BLANK",
        points: 3,
        correctText: "answer",
      }),
    ];

    const result = scoreAttempt(questions, {
      q1: { type: "MULTIPLE_CHOICE", optionId: "ok" },
      q2: { type: "FILL_BLANK", text: "answer" },
    });

    expect(result.score).toBe(4);
    expect(result.maxScore).toBe(4);
    expect(result.details).toHaveLength(2);
    expect(result.details[1].isCorrect).toBe(true);
  });

  it("treats unanswered questions as zero points", () => {
    const questions: Q[] = [
      baseQuestion({
        id: "q1",
        type: "REFLECTION",
        points: 5,
      }),
    ];
    const result = scoreAttempt(questions, {});
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(5);
    expect(result.details[0].answer).toBeNull();
  });
});
