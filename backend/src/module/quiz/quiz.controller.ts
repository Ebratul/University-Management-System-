import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { getRequestUser } from "../../utils/getRequestUser";
import { sendResponse } from "../../utils/sendResponse";
import type { IQuizResultsQuery } from "./quiz.interface";
import { QuizService } from "./quiz.service";

const offeringId = (req: Request) => req.params.offeringId as string;
const quizId = (req: Request) => req.params.quizId as string;

const respond = (
	res: Response,
	message: string,
	data: unknown,
	statusCode: number = httpStatus.OK,
) => sendResponse(res, { statusCode, success: true, message, data });

const createQuiz = catchAsync(async (req, res) =>
	respond(
		res,
		"Quiz created successfully.",
		await QuizService.createQuiz(
			offeringId(req),
			req.body,
			getRequestUser(req),
		),
		httpStatus.CREATED,
	),
);

const listQuizzes = catchAsync(async (req, res) =>
	respond(
		res,
		"Quizzes retrieved successfully.",
		await QuizService.listQuizzes(offeringId(req), getRequestUser(req)),
	),
);

const getQuiz = catchAsync(async (req, res) =>
	respond(
		res,
		"Quiz retrieved successfully.",
		await QuizService.getQuiz(quizId(req), getRequestUser(req)),
	),
);

const updateQuiz = catchAsync(async (req, res) =>
	respond(
		res,
		"Quiz updated successfully.",
		await QuizService.updateQuiz(quizId(req), req.body, getRequestUser(req)),
	),
);

const replaceQuestions = catchAsync(async (req, res) =>
	respond(
		res,
		"Quiz questions saved successfully.",
		await QuizService.replaceQuestions(
			quizId(req),
			req.body.questions,
			getRequestUser(req),
		),
	),
);

const deleteQuiz = catchAsync(async (req, res) => {
	await QuizService.deleteQuiz(quizId(req), getRequestUser(req));
	respond(res, "Quiz deleted successfully.", null);
});

const publishQuiz = catchAsync(async (req, res) =>
	respond(
		res,
		"Quiz published.",
		await QuizService.publishQuiz(quizId(req), getRequestUser(req)),
	),
);

const unpublishQuiz = catchAsync(async (req, res) =>
	respond(
		res,
		"Quiz moved back to draft.",
		await QuizService.unpublishQuiz(quizId(req), getRequestUser(req)),
	),
);

const startQuiz = catchAsync(async (req, res) =>
	respond(
		res,
		"Quiz started.",
		await QuizService.startQuiz(quizId(req), getRequestUser(req)),
	),
);

const beginAttempt = catchAsync(async (req, res) =>
	respond(
		res,
		"Quiz attempt started.",
		await QuizService.beginAttempt(quizId(req), getRequestUser(req)),
	),
);

const saveAnswers = catchAsync(async (req, res) =>
	respond(
		res,
		"Answers saved.",
		await QuizService.saveAnswers(
			quizId(req),
			req.body.answers,
			getRequestUser(req),
		),
	),
);

const submitAttempt = catchAsync(async (req, res) =>
	respond(
		res,
		"Quiz submitted successfully.",
		await QuizService.submitAttempt(
			quizId(req),
			req.body.answers,
			getRequestUser(req),
		),
	),
);

const getMyResult = catchAsync(async (req, res) =>
	respond(
		res,
		"Quiz result retrieved successfully.",
		await QuizService.getMyResult(quizId(req), getRequestUser(req)),
	),
);

const getResults = catchAsync(async (req, res) =>
	respond(
		res,
		"Quiz results retrieved successfully.",
		await QuizService.getResults(
			quizId(req),
			req.query as IQuizResultsQuery,
			getRequestUser(req),
		),
	),
);

export const QuizController = {
	createQuiz,
	listQuizzes,
	getQuiz,
	updateQuiz,
	replaceQuestions,
	deleteQuiz,
	publishQuiz,
	unpublishQuiz,
	startQuiz,
	beginAttempt,
	saveAnswers,
	submitAttempt,
	getMyResult,
	getResults,
};
