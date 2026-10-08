import type { Prisma, QuizAttemptStatus } from "@prisma/client";
import httpStatus from "http-status";

import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../../utils/auditLog";
import {
	requireStaffAccess,
	resolveOfferingAccess,
} from "../../utils/offeringAccess";
import type {
	IAnswerInput,
	ICreateQuizPayload,
	IQuizQuestionInput,
	IQuizResultsQuery,
	IUpdateQuizPayload,
} from "./quiz.interface";

// ---------------------------------------------------------------------------
// Time is decided here, by the server. The browser timer is only a display:
// every read/write below first calls syncQuizState(), which closes an expired
// quiz and auto-submits whatever its students had saved. There is no cron job
// to depend on (the API runs serverless), so expiry is applied lazily, on the
// first request after endsAt, and is idempotent.
// ---------------------------------------------------------------------------

// Never sent to students while a quiz is running.
const STUDENT_QUESTION_SELECT = {
	id: true,
	order: true,
	question: true,
	optionA: true,
	optionB: true,
	optionC: true,
	optionD: true,
} as const;

const STAFF_QUESTION_SELECT = {
	...STUDENT_QUESTION_SELECT,
	correctAnswer: true,
	explanation: true,
	sourceReference: true,
} as const;

const ATTEMPT_SUMMARY_SELECT = {
	id: true,
	status: true,
	score: true,
	totalQuestions: true,
	percentage: true,
	startedAt: true,
	submittedAt: true,
} as const;

const STUDENT_SELECT = {
	id: true,
	studentId: true,
	registrationNumber: true,
	name: true,
	user: { select: { imageUrl: true } },
} as const;

type TQuizRow = Awaited<ReturnType<typeof loadQuiz>>;

const loadQuiz = async (quizId: string) => {
	const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
	if (!quiz) throw new AppError(httpStatus.NOT_FOUND, "Quiz not found.");
	return quiz;
};

const toOption = (q: IQuizQuestionInput, order: number) => ({
	order,
	question: q.question,
	optionA: q.optionA,
	optionB: q.optionB,
	optionC: q.optionC,
	optionD: q.optionD,
	correctAnswer: q.correctAnswer,
	explanation: q.explanation ?? null,
	sourceReference: q.sourceReference ?? null,
});

const isExpired = (quiz: { status: string; endsAt: Date | null }) =>
	quiz.status === "ACTIVE" && quiz.endsAt !== null && quiz.endsAt <= new Date();

// Scores one attempt from its saved answers. Guarded on IN_PROGRESS so two
// racing callers (a late submit and an expiry sweep) cannot score it twice.
const finalizeAttempt = async (
	tx: Prisma.TransactionClient,
	attemptId: string,
	quizId: string,
	status: Extract<QuizAttemptStatus, "SUBMITTED" | "AUTO_SUBMITTED">,
) => {
	const [questions, answers] = await Promise.all([
		tx.quizQuestion.findMany({
			where: { quizId },
			select: { id: true, correctAnswer: true },
		}),
		tx.quizAnswer.findMany({ where: { attemptId } }),
	]);

	const correctByQuestion = new Map(
		questions.map((q) => [q.id, q.correctAnswer]),
	);
	const total = questions.length;
	let score = 0;
	const graded = answers.map((a) => {
		const isCorrect = correctByQuestion.get(a.questionId) === a.selectedAnswer;
		if (isCorrect) score += 1;
		return { id: a.id, isCorrect };
	});

	const claimed = await tx.quizAttempt.updateMany({
		where: { id: attemptId, status: "IN_PROGRESS" },
		data: {
			status,
			submittedAt: new Date(),
			score,
			totalQuestions: total,
			percentage: total === 0 ? 0 : Math.round((score / total) * 1000) / 10,
		},
	});
	if (claimed.count === 0) return;

	for (const g of graded) {
		await tx.quizAnswer.update({
			where: { id: g.id },
			data: { isCorrect: g.isCorrect },
		});
	}
};

const closeExpiredQuiz = async (quizId: string) => {
	await prisma.$transaction(async (tx) => {
		await tx.quiz.updateMany({
			where: { id: quizId, status: "ACTIVE", endsAt: { lte: new Date() } },
			data: { status: "ENDED" },
		});
		const open = await tx.quizAttempt.findMany({
			where: { quizId, status: "IN_PROGRESS" },
			select: { id: true },
		});
		for (const attempt of open) {
			await finalizeAttempt(tx, attempt.id, quizId, "AUTO_SUBMITTED");
		}
	});
};

const syncQuizState = async (quiz: TQuizRow): Promise<TQuizRow> => {
	if (!isExpired(quiz)) return quiz;
	await closeExpiredQuiz(quiz.id);
	return { ...quiz, status: "ENDED" };
};

const closeExpiredForOffering = async (offeringId: string) => {
	const expired = await prisma.quiz.findMany({
		where: {
			courseOfferingId: offeringId,
			status: "ACTIVE",
			endsAt: { lte: new Date() },
		},
		select: { id: true },
	});
	for (const q of expired) await closeExpiredQuiz(q.id);
};

const assertMaterialInOffering = async (
	materialId: string,
	offeringId: string,
) => {
	const material = await prisma.courseMaterial.findFirst({
		where: { id: materialId, courseOfferingId: offeringId },
		select: { id: true },
	});
	if (!material) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"The selected material does not belong to this course.",
		);
	}
};

const assertEditable = (quiz: TQuizRow, allowed: string[], what: string) => {
	if (!allowed.includes(quiz.status)) {
		throw new AppError(
			httpStatus.CONFLICT,
			`You cannot ${what} a quiz that is ${quiz.status.toLowerCase()}.`,
		);
	}
};

const audit = (
	action: string,
	quizId: string,
	user: RequestUser,
	description?: string,
) =>
	recordAuditLog({
		action,
		entityType: "Quiz",
		entityId: quizId,
		description,
		actor: { userId: user.userId, email: user.email, role: user.role },
	});

// ----------------------------- Teacher: management -------------------------

const createQuiz = async (
	offeringId: string,
	payload: ICreateQuizPayload,
	user: RequestUser,
) => {
	await requireStaffAccess(user, offeringId);
	if (payload.materialId) {
		await assertMaterialInOffering(payload.materialId, offeringId);
	}

	const quiz = await prisma.quiz.create({
		data: {
			title: payload.title,
			description: payload.description,
			durationMinutes: payload.durationMinutes,
			showAnswersAfterEnd: payload.showAnswersAfterEnd,
			materialId: payload.materialId,
			courseOfferingId: offeringId,
			createdByUserId: user.userId,
			questions: payload.questions?.length
				? { create: payload.questions.map((q, i) => toOption(q, i + 1)) }
				: undefined,
		},
		select: { id: true },
	});

	await audit("QUIZ_CREATED", quiz.id, user, payload.title);
	return getQuiz(quiz.id, user);
};

const listQuizzes = async (offeringId: string, user: RequestUser) => {
	const access = await resolveOfferingAccess(user, offeringId);
	await closeExpiredForOffering(offeringId);

	const isStudent = access.kind === "student";
	const quizzes = await prisma.quiz.findMany({
		where: {
			courseOfferingId: offeringId,
			...(isStudent ? { status: { not: "DRAFT" } } : {}),
		},
		select: {
			id: true,
			title: true,
			description: true,
			durationMinutes: true,
			status: true,
			startedAt: true,
			endsAt: true,
			createdAt: true,
			material: { select: { id: true, title: true } },
			_count: { select: { questions: true, attempts: true } },
			...(isStudent
				? {
						attempts: {
							where: { studentId: access.studentId },
							select: ATTEMPT_SUMMARY_SELECT,
						},
					}
				: {}),
		},
		orderBy: { createdAt: "desc" },
	});

	return {
		serverTime: new Date(),
		quizzes: quizzes.map(({ attempts, ...quiz }) => ({
			...quiz,
			...(isStudent ? { myAttempt: attempts?.[0] ?? null } : {}),
		})),
	};
};

const getQuiz = async (quizId: string, user: RequestUser) => {
	const quiz = await syncQuizState(await loadQuiz(quizId));
	const access = await resolveOfferingAccess(user, quiz.courseOfferingId);
	const isStudent = access.kind === "student";

	if (isStudent && quiz.status === "DRAFT") {
		throw new AppError(httpStatus.NOT_FOUND, "Quiz not found.");
	}

	const [material, questionCount, attemptCount, myAttempt, questions] =
		await Promise.all([
			quiz.materialId
				? prisma.courseMaterial.findUnique({
						where: { id: quiz.materialId },
						select: { id: true, title: true },
					})
				: null,
			prisma.quizQuestion.count({ where: { quizId } }),
			prisma.quizAttempt.count({ where: { quizId } }),
			isStudent
				? prisma.quizAttempt.findUnique({
						where: {
							quizId_studentId: {
								quizId,
								studentId: access.studentId as string,
							},
						},
						select: ATTEMPT_SUMMARY_SELECT,
					})
				: null,
			// Questions (with answers) are only ever returned to staff here.
			isStudent
				? []
				: prisma.quizQuestion.findMany({
						where: { quizId },
						select: STAFF_QUESTION_SELECT,
						orderBy: { order: "asc" },
					}),
		]);

	return {
		id: quiz.id,
		courseOfferingId: quiz.courseOfferingId,
		title: quiz.title,
		description: quiz.description,
		durationMinutes: quiz.durationMinutes,
		status: quiz.status,
		startedAt: quiz.startedAt,
		endsAt: quiz.endsAt,
		showAnswersAfterEnd: quiz.showAnswersAfterEnd,
		material,
		questionCount,
		attemptCount,
		serverTime: new Date(),
		...(isStudent ? { myAttempt } : { questions }),
	};
};

const updateQuiz = async (
	quizId: string,
	payload: IUpdateQuizPayload,
	user: RequestUser,
) => {
	const quiz = await syncQuizState(await loadQuiz(quizId));
	await requireStaffAccess(user, quiz.courseOfferingId);
	assertEditable(quiz, ["DRAFT", "UPCOMING"], "edit");
	if (payload.materialId) {
		await assertMaterialInOffering(payload.materialId, quiz.courseOfferingId);
	}

	await prisma.quiz.update({ where: { id: quizId }, data: payload });
	await audit("QUIZ_UPDATED", quizId, user);
	return getQuiz(quizId, user);
};

const replaceQuestions = async (
	quizId: string,
	questions: IQuizQuestionInput[],
	user: RequestUser,
) => {
	const quiz = await syncQuizState(await loadQuiz(quizId));
	await requireStaffAccess(user, quiz.courseOfferingId);
	assertEditable(quiz, ["DRAFT"], "change the questions of");

	await prisma.$transaction([
		prisma.quizQuestion.deleteMany({ where: { quizId } }),
		prisma.quizQuestion.createMany({
			data: questions.map((q, i) => ({ ...toOption(q, i + 1), quizId })),
		}),
	]);

	await audit(
		"QUIZ_QUESTIONS_UPDATED",
		quizId,
		user,
		`${questions.length} questions`,
	);
	return getQuiz(quizId, user);
};

const deleteQuiz = async (quizId: string, user: RequestUser) => {
	const quiz = await syncQuizState(await loadQuiz(quizId));
	await requireStaffAccess(user, quiz.courseOfferingId);
	assertEditable(quiz, ["DRAFT", "UPCOMING"], "delete");

	await prisma.quiz.delete({ where: { id: quizId } });
	await audit("QUIZ_DELETED", quizId, user, quiz.title);
};

// DRAFT -> UPCOMING. The teacher must have reviewed a non-empty question set.
const publishQuiz = async (quizId: string, user: RequestUser) => {
	const quiz = await syncQuizState(await loadQuiz(quizId));
	await requireStaffAccess(user, quiz.courseOfferingId);
	assertEditable(quiz, ["DRAFT"], "publish");

	const questionCount = await prisma.quizQuestion.count({ where: { quizId } });
	if (questionCount === 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Add at least one question before publishing.",
		);
	}

	await prisma.quiz.updateMany({
		where: { id: quizId, status: "DRAFT" },
		data: { status: "UPCOMING" },
	});
	await audit("QUIZ_PUBLISHED", quizId, user);
	return getQuiz(quizId, user);
};

const unpublishQuiz = async (quizId: string, user: RequestUser) => {
	const quiz = await syncQuizState(await loadQuiz(quizId));
	await requireStaffAccess(user, quiz.courseOfferingId);
	assertEditable(quiz, ["UPCOMING"], "unpublish");

	await prisma.quiz.updateMany({
		where: { id: quizId, status: "UPCOMING" },
		data: { status: "DRAFT" },
	});
	await audit("QUIZ_UNPUBLISHED", quizId, user);
	return getQuiz(quizId, user);
};

// UPCOMING -> ACTIVE. endsAt is computed here from the server clock.
const startQuiz = async (quizId: string, user: RequestUser) => {
	const quiz = await syncQuizState(await loadQuiz(quizId));
	await requireStaffAccess(user, quiz.courseOfferingId);

	if (quiz.status === "DRAFT") {
		throw new AppError(
			httpStatus.CONFLICT,
			"Publish the quiz before starting it.",
		);
	}
	if (quiz.status !== "UPCOMING") {
		throw new AppError(
			httpStatus.CONFLICT,
			quiz.status === "ACTIVE"
				? "This quiz has already started."
				: "This quiz has already ended.",
		);
	}

	const startedAt = new Date();
	const endsAt = new Date(startedAt.getTime() + quiz.durationMinutes * 60_000);
	// Conditional update: two teachers double-clicking Start cannot both win.
	const started = await prisma.quiz.updateMany({
		where: { id: quizId, status: "UPCOMING" },
		data: { status: "ACTIVE", startedAt, endsAt },
	});
	if (started.count === 0) {
		throw new AppError(httpStatus.CONFLICT, "This quiz has already started.");
	}

	await audit("QUIZ_STARTED", quizId, user, `ends ${endsAt.toISOString()}`);
	return getQuiz(quizId, user);
};

// ----------------------------- Student: taking -----------------------------

const requireStudent = async (user: RequestUser, offeringId: string) => {
	const access = await resolveOfferingAccess(user, offeringId);
	if (access.kind !== "student" || !access.studentId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Only enrolled students can take a quiz.",
		);
	}
	return access.studentId;
};

const assertAnswersBelongToQuiz = async (
	quizId: string,
	answers: IAnswerInput[],
) => {
	if (answers.length === 0) return;
	const count = await prisma.quizQuestion.count({
		where: { quizId, id: { in: answers.map((a) => a.questionId) } },
	});
	if (count !== answers.length) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Some answers do not belong to this quiz.",
		);
	}
};

const upsertAnswers = (
	tx: Prisma.TransactionClient,
	attemptId: string,
	answers: IAnswerInput[],
) =>
	Promise.all(
		answers.map((a) =>
			tx.quizAnswer.upsert({
				where: {
					attemptId_questionId: { attemptId, questionId: a.questionId },
				},
				update: { selectedAnswer: a.selected },
				create: {
					attemptId,
					questionId: a.questionId,
					selectedAnswer: a.selected,
				},
			}),
		),
	);

const timeOver = () =>
	new AppError(httpStatus.CONFLICT, "Time is over. Your quiz has ended.");

// Starts (or resumes) the student's single attempt. Questions are sent without
// answers; the response carries the server clock and the deadline.
const beginAttempt = async (quizId: string, user: RequestUser) => {
	const quiz = await syncQuizState(await loadQuiz(quizId));
	const studentId = await requireStudent(user, quiz.courseOfferingId);

	if (quiz.status === "DRAFT") {
		throw new AppError(httpStatus.NOT_FOUND, "Quiz not found.");
	}
	if (quiz.status === "UPCOMING") {
		throw new AppError(httpStatus.CONFLICT, "Quiz has not started yet.");
	}

	let attempt = await prisma.quizAttempt.findUnique({
		where: { quizId_studentId: { quizId, studentId } },
	});
	if (attempt && attempt.status !== "IN_PROGRESS") {
		throw new AppError(
			httpStatus.CONFLICT,
			attempt.status === "AUTO_SUBMITTED"
				? "Time is over. Your quiz has ended."
				: "You have already submitted this quiz.",
		);
	}
	if (quiz.status === "ENDED") throw timeOver();

	if (!attempt) {
		try {
			attempt = await prisma.quizAttempt.create({
				data: { quizId, studentId },
			});
		} catch {
			// Double-click / two tabs raced on the unique (quiz, student) pair.
			attempt = await prisma.quizAttempt.findUnique({
				where: { quizId_studentId: { quizId, studentId } },
			});
			if (!attempt)
				throw new AppError(httpStatus.CONFLICT, "Please try again.");
		}
	}

	const [questions, saved] = await Promise.all([
		prisma.quizQuestion.findMany({
			where: { quizId },
			select: STUDENT_QUESTION_SELECT,
			orderBy: { order: "asc" },
		}),
		prisma.quizAnswer.findMany({
			where: { attemptId: attempt.id },
			select: { questionId: true, selectedAnswer: true },
		}),
	]);

	return {
		serverTime: new Date(),
		quiz: {
			id: quiz.id,
			title: quiz.title,
			description: quiz.description,
			durationMinutes: quiz.durationMinutes,
			startedAt: quiz.startedAt,
			endsAt: quiz.endsAt,
		},
		attempt: {
			id: attempt.id,
			status: attempt.status,
			startedAt: attempt.startedAt,
		},
		questions,
		answers: Object.fromEntries(
			saved.map((a) => [a.questionId, a.selectedAnswer]),
		),
	};
};

// Autosave while the quiz is running, so an expiry still scores what was done.
const saveAnswers = async (
	quizId: string,
	answers: IAnswerInput[],
	user: RequestUser,
) => {
	const quiz = await syncQuizState(await loadQuiz(quizId));
	const studentId = await requireStudent(user, quiz.courseOfferingId);

	const attempt = await prisma.quizAttempt.findUnique({
		where: { quizId_studentId: { quizId, studentId } },
	});
	if (!attempt) {
		throw new AppError(httpStatus.CONFLICT, "Start the quiz first.");
	}
	if (attempt.status !== "IN_PROGRESS") throw timeOver();
	if (quiz.status !== "ACTIVE") throw timeOver();

	await assertAnswersBelongToQuiz(quizId, answers);
	await prisma.$transaction((tx) => upsertAnswers(tx, attempt.id, answers));
	return { saved: answers.length, serverTime: new Date() };
};

const submitAttempt = async (
	quizId: string,
	answers: IAnswerInput[] | undefined,
	user: RequestUser,
) => {
	// An expired quiz is closed (and this attempt auto-submitted from its saved
	// answers) before we look at anything the client sent: a late submit is
	// rejected, never accepted.
	const quiz = await syncQuizState(await loadQuiz(quizId));
	const studentId = await requireStudent(user, quiz.courseOfferingId);

	const attempt = await prisma.quizAttempt.findUnique({
		where: { quizId_studentId: { quizId, studentId } },
	});
	if (!attempt) {
		throw new AppError(httpStatus.CONFLICT, "Start the quiz first.");
	}
	if (attempt.status === "AUTO_SUBMITTED") throw timeOver();
	if (attempt.status === "SUBMITTED") {
		throw new AppError(
			httpStatus.CONFLICT,
			"You have already submitted this quiz.",
		);
	}
	if (quiz.status !== "ACTIVE") throw timeOver();

	if (answers?.length) await assertAnswersBelongToQuiz(quizId, answers);

	await prisma.$transaction(async (tx) => {
		if (answers?.length) await upsertAnswers(tx, attempt.id, answers);
		await finalizeAttempt(tx, attempt.id, quizId, "SUBMITTED");
	});

	return getMyResult(quizId, user);
};

// Score is shown once submitted; the answer key only after the quiz has ended.
const getMyResult = async (quizId: string, user: RequestUser) => {
	const quiz = await syncQuizState(await loadQuiz(quizId));
	const studentId = await requireStudent(user, quiz.courseOfferingId);

	const attempt = await prisma.quizAttempt.findUnique({
		where: { quizId_studentId: { quizId, studentId } },
		select: { ...ATTEMPT_SUMMARY_SELECT, answers: true },
	});
	if (!attempt) throw new AppError(httpStatus.NOT_FOUND, "No attempt found.");
	if (attempt.status === "IN_PROGRESS") {
		throw new AppError(
			httpStatus.CONFLICT,
			"You have not submitted this quiz.",
		);
	}

	const total = attempt.totalQuestions ?? 0;
	const correct = attempt.score ?? 0;
	const revealKey = quiz.status === "ENDED" && quiz.showAnswersAfterEnd;

	const review = revealKey
		? await prisma.quizQuestion
				.findMany({
					where: { quizId },
					select: STAFF_QUESTION_SELECT,
					orderBy: { order: "asc" },
				})
				.then((questions) => {
					const picked = new Map(
						attempt.answers.map((a) => [a.questionId, a.selectedAnswer]),
					);
					return questions.map((q) => ({
						...q,
						selectedAnswer: picked.get(q.id) ?? null,
						isCorrect: picked.get(q.id) === q.correctAnswer,
					}));
				})
		: undefined;

	return {
		quizId,
		quizTitle: quiz.title,
		status: attempt.status,
		score: correct,
		totalQuestions: total,
		correct,
		wrong: total - correct,
		percentage: attempt.percentage ?? 0,
		submittedAt: attempt.submittedAt,
		quizEnded: quiz.status === "ENDED",
		...(review ? { review } : {}),
	};
};

// ----------------------------- Teacher: results ----------------------------

const getResults = async (
	quizId: string,
	query: IQuizResultsQuery,
	user: RequestUser,
) => {
	const quiz = await syncQuizState(await loadQuiz(quizId));
	await requireStaffAccess(user, quiz.courseOfferingId);

	const search = query.search?.trim();
	const [enrolled, attempts] = await Promise.all([
		prisma.enrollment.findMany({
			where: {
				courseOfferingId: quiz.courseOfferingId,
				deletedAt: null,
				status: { in: ["ENROLLED", "COMPLETED"] },
				student: {
					deletedAt: null,
					...(search
						? {
								OR: [
									{ name: { contains: search, mode: "insensitive" } },
									{
										registrationNumber: {
											contains: search,
											mode: "insensitive",
										},
									},
								],
							}
						: {}),
				},
			},
			select: { student: { select: STUDENT_SELECT } },
		}),
		prisma.quizAttempt.findMany({
			where: { quizId },
			select: { studentId: true, ...ATTEMPT_SUMMARY_SELECT },
		}),
	]);

	const byStudent = new Map(attempts.map((a) => [a.studentId, a]));
	const rows = enrolled.map(({ student }) => {
		const a = byStudent.get(student.id);
		return {
			student: {
				id: student.id,
				studentId: student.studentId,
				registrationNumber: student.registrationNumber,
				name: student.name,
				imageUrl: student.user.imageUrl,
			},
			status: a?.status ?? "NOT_ATTEMPTED",
			score: a?.score ?? null,
			totalQuestions: a?.totalQuestions ?? null,
			percentage: a?.percentage ?? null,
			submittedAt: a?.submittedAt ?? null,
		};
	});

	const dir = query.order === "desc" ? -1 : 1;
	const sortBy = query.sortBy ?? "registrationNumber";
	const cmp = (
		a: string | number | Date | null,
		b: string | number | Date | null,
	) => {
		// Missing values (no attempt yet) always sort last.
		if (a === null && b === null) return 0;
		if (a === null) return 1;
		if (b === null) return -1;
		const x = a instanceof Date ? a.getTime() : a;
		const y = b instanceof Date ? b.getTime() : b;
		return x < y ? -dir : x > y ? dir : 0;
	};
	rows.sort((r1, r2) => {
		switch (sortBy) {
			case "name":
				return cmp(
					r1.student.name.toLowerCase(),
					r2.student.name.toLowerCase(),
				);
			case "score":
				return cmp(r1.percentage, r2.percentage);
			case "submittedAt":
				return cmp(r1.submittedAt, r2.submittedAt);
			default:
				return cmp(
					r1.student.registrationNumber,
					r2.student.registrationNumber,
				);
		}
	});

	const submitted = rows.filter((r) => r.percentage !== null);
	return {
		quiz: {
			id: quiz.id,
			title: quiz.title,
			status: quiz.status,
			endsAt: quiz.endsAt,
		},
		summary: {
			enrolled: rows.length,
			attempted: submitted.length,
			averagePercentage: submitted.length
				? Math.round(
						(submitted.reduce((sum, r) => sum + (r.percentage ?? 0), 0) /
							submitted.length) *
							10,
					) / 10
				: 0,
		},
		results: rows,
	};
};

export const QuizService = {
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
