import type { QuizChoice } from "@prisma/client";

export interface IQuizQuestionInput {
	question: string;
	optionA: string;
	optionB: string;
	optionC: string;
	optionD: string;
	correctAnswer: QuizChoice;
	explanation?: string;
	sourceReference?: string;
}

export interface ICreateQuizPayload {
	title: string;
	description?: string;
	durationMinutes: number;
	materialId?: string;
	showAnswersAfterEnd?: boolean;
	questions?: IQuizQuestionInput[];
}

export interface IUpdateQuizPayload {
	title?: string;
	description?: string;
	durationMinutes?: number;
	materialId?: string | null;
	showAnswersAfterEnd?: boolean;
}

export interface IAnswerInput {
	questionId: string;
	selected: QuizChoice;
}

export interface IQuizResultsQuery {
	search?: string;
	sortBy?: "name" | "registrationNumber" | "score" | "submittedAt";
	order?: "asc" | "desc";
}
