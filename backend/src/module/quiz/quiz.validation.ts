import { z } from "zod";

import {
	MAX_QUESTIONS_PER_QUIZ,
	MAX_QUIZ_DURATION_MINUTES,
} from "./quiz.constant";

const choice = z.enum(["A", "B", "C", "D"]);
const option = z.string().trim().min(1, "Option cannot be empty.").max(500);

const QuestionSchema = z
	.object({
		question: z.string().trim().min(5).max(1000),
		optionA: option,
		optionB: option,
		optionC: option,
		optionD: option,
		correctAnswer: choice,
		explanation: z.string().trim().max(1000).optional(),
		sourceReference: z.string().trim().max(300).optional(),
	})
	.refine(
		(q) =>
			new Set(
				[q.optionA, q.optionB, q.optionC, q.optionD].map((o) =>
					o.toLowerCase(),
				),
			).size === 4,
		{ message: "A question needs four different options." },
	);

const questionList = z.array(QuestionSchema).max(MAX_QUESTIONS_PER_QUIZ);

const durationMinutes = z
	.number()
	.int()
	.min(1, "Duration must be at least 1 minute.")
	.max(MAX_QUIZ_DURATION_MINUTES);

const CreateZodSchema = z.object({
	title: z.string().trim().min(3).max(150),
	description: z.string().trim().max(1000).optional(),
	durationMinutes,
	materialId: z.uuid().optional(),
	showAnswersAfterEnd: z.boolean().optional(),
	questions: questionList.optional(),
});

const UpdateZodSchema = z
	.object({
		title: z.string().trim().min(3).max(150).optional(),
		description: z.string().trim().max(1000).optional(),
		durationMinutes: durationMinutes.optional(),
		materialId: z.uuid().nullable().optional(),
		showAnswersAfterEnd: z.boolean().optional(),
	})
	.refine((v) => Object.keys(v).length > 0, {
		message: "Provide at least one field to update.",
	});

// The whole question list is replaced in one go: that is how the teacher's
// edit / delete / add / reorder all reach the server.
const ReplaceQuestionsZodSchema = z.object({ questions: questionList });

const answerList = z
	.array(z.object({ questionId: z.uuid(), selected: choice }))
	.max(MAX_QUESTIONS_PER_QUIZ)
	.refine(
		(answers) =>
			new Set(answers.map((a) => a.questionId)).size === answers.length,
		{ message: "Each question can be answered only once." },
	);

const SaveAnswersZodSchema = z.object({ answers: answerList });
const SubmitZodSchema = z.object({ answers: answerList.optional() });

const ResultsQuerySchema = z.object({
	search: z.string().trim().max(100).optional(),
	sortBy: z
		.enum(["name", "registrationNumber", "score", "submittedAt"])
		.optional(),
	order: z.enum(["asc", "desc"]).optional(),
});

export const QuizValidation = {
	QuestionSchema,
	CreateZodSchema,
	UpdateZodSchema,
	ReplaceQuestionsZodSchema,
	SaveAnswersZodSchema,
	SubmitZodSchema,
	ResultsQuerySchema,
};
