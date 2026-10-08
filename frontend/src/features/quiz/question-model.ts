import type { QuizChoice, QuizQuestionDraft } from "@/types/entities";

/** A question being edited in the browser. `key` is a stable id for React lists. */
export type EditableQuestion = QuizQuestionDraft & {
  key: string;
  explanation: string;
  sourceReference: string;
  fromAI: boolean;
};

export const CHOICES: QuizChoice[] = ["A", "B", "C", "D"];

export const optionField = {
  A: "optionA",
  B: "optionB",
  C: "optionC",
  D: "optionD",
} as const;

let counter = 0;
export function newKey(): string {
  counter += 1;
  return `q-${Date.now().toString(36)}-${counter}`;
}

export function blankQuestion(): EditableQuestion {
  return {
    key: newKey(),
    question: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctAnswer: "A",
    explanation: "",
    sourceReference: "",
    fromAI: false,
  };
}

export function toEditable(q: QuizQuestionDraft, fromAI = false): EditableQuestion {
  return {
    key: newKey(),
    question: q.question,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation ?? "",
    sourceReference: q.sourceReference ?? "",
    fromAI,
  };
}

/** The shape the API stores. Empty optional text is omitted. */
export function toDraft(q: EditableQuestion): QuizQuestionDraft {
  return {
    question: q.question.trim(),
    optionA: q.optionA.trim(),
    optionB: q.optionB.trim(),
    optionC: q.optionC.trim(),
    optionD: q.optionD.trim(),
    correctAnswer: q.correctAnswer,
    ...(q.explanation.trim() ? { explanation: q.explanation.trim() } : {}),
    ...(q.sourceReference.trim() ? { sourceReference: q.sourceReference.trim() } : {}),
  };
}

/** Same rules as the server (backend quiz.validation.ts), so errors show before saving. */
export function validateQuestion(q: EditableQuestion): string | null {
  if (q.question.trim().length < 5) return "Write the question (at least 5 characters).";
  const options = [q.optionA, q.optionB, q.optionC, q.optionD].map((o) => o.trim());
  if (options.some((o) => o === "")) return "Fill in all four options.";
  if (new Set(options.map((o) => o.toLowerCase())).size !== 4) return "The four options must all be different.";
  return null;
}
