import httpStatus from "http-status";
import { z } from "zod";

import config from "../../config";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../../utils/auditLog";
import { requireStaffAccess } from "../../utils/offeringAccess";
import { MaterialService } from "../material/material.service";
import type { IQuizQuestionInput } from "../quiz/quiz.interface";
import { QuizValidation } from "../quiz/quiz.validation";
import type { IGenerateQuizPayload } from "./ai.interface";

// What the Python service returns. Parsed again here: the Node API never
// trusts a response shape, even from its own internal service.
const RagResponseSchema = z.object({
	questions: z.array(
		z.object({
			question: z.string(),
			options: z.object({
				A: z.string(),
				B: z.string(),
				C: z.string(),
				D: z.string(),
			}),
			correct_answer: z.enum(["A", "B", "C", "D"]),
			explanation: z.string().optional(),
			source_reference: z.string().optional(),
		}),
	),
	warnings: z.array(z.string()).default([]),
	stats: z.record(z.string(), z.unknown()).optional(),
});

const RagErrorSchema = z.object({
	code: z.string().optional(),
	message: z.string().optional(),
});

const callRag = async (body: Record<string, unknown>) => {
	if (!config.rag_service_url || !config.rag_service_token) {
		throw new AppError(
			httpStatus.SERVICE_UNAVAILABLE,
			"AI quiz generation is not configured on this server.",
		);
	}

	let response: Response;
	try {
		response = await fetch(`${config.rag_service_url}/generate-quiz`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Internal-Token": config.rag_service_token,
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(config.rag_service_timeout_ms),
		});
	} catch (error) {
		console.error("RAG service request failed:", error);
		throw new AppError(
			httpStatus.SERVICE_UNAVAILABLE,
			"The AI service is unavailable or took too long. Please try again.",
		);
	}

	const json: unknown = await response.json().catch(() => null);
	if (response.ok) return json;

	const err = RagErrorSchema.safeParse(json);
	const code = err.success ? err.data.code : undefined;
	const message = err.success ? err.data.message : undefined;

	// Errors that are about the teacher's material are safe to show as-is.
	if (code === "INSUFFICIENT_CONTEXT") {
		throw new AppError(
			httpStatus.UNPROCESSABLE_ENTITY,
			message ?? "Insufficient information in the provided material.",
		);
	}
	if (code === "DOCUMENT_ERROR") {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			message ?? "The PDF could not be processed.",
		);
	}
	// Anything else (bad token, model failure, crash) is our problem: log the
	// detail, show the user something generic.
	console.error(`RAG service responded ${response.status}:`, json);
	throw new AppError(
		httpStatus.BAD_GATEWAY,
		"Question generation failed. Please try again.",
	);
};

// Generates a DRAFT question set from one PDF. Nothing is saved: the teacher
// reviews and edits the questions, then saves them to a quiz via
// POST /course-offerings/:id/quizzes or PUT /quizzes/:id/questions.
const generateQuiz = async (
	payload: IGenerateQuizPayload,
	user: RequestUser,
) => {
	await requireStaffAccess(user, payload.offeringId);

	// Scoped by offering: a material id from another course never resolves, so
	// the model can only ever read the PDF of the course the teacher is in.
	const material = await prisma.courseMaterial.findFirst({
		where: { id: payload.materialId, courseOfferingId: payload.offeringId },
		select: { id: true, title: true },
	});
	if (!material) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Material not found in this course.",
		);
	}

	// Short-lived signed link: the RAG service downloads the PDF once, right now.
	const { url } = await MaterialService.getAccessUrl(
		payload.offeringId,
		payload.materialId,
		user,
	);

	const raw = await callRag({
		document_url: url,
		course_id: payload.offeringId,
		material_id: payload.materialId,
		number_of_questions: payload.numberOfQuestions,
		difficulty: payload.difficulty,
	});

	const parsed = RagResponseSchema.safeParse(raw);
	if (!parsed.success) {
		console.error("RAG service returned an unexpected shape:", parsed.error);
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			"Question generation failed. Please try again.",
		);
	}

	const warnings = [...parsed.data.warnings];
	const questions: IQuizQuestionInput[] = [];
	for (const q of parsed.data.questions) {
		// Same rules as a teacher-written question (four distinct options etc.).
		const candidate = QuizValidation.QuestionSchema.safeParse({
			question: q.question,
			optionA: q.options.A,
			optionB: q.options.B,
			optionC: q.options.C,
			optionD: q.options.D,
			correctAnswer: q.correct_answer,
			explanation: q.explanation || undefined,
			sourceReference: q.source_reference || undefined,
		});
		if (candidate.success) questions.push(candidate.data);
	}

	const dropped = parsed.data.questions.length - questions.length;
	if (dropped > 0) {
		warnings.push(
			`${dropped} generated question(s) were discarded as invalid.`,
		);
	}
	if (questions.length === 0) {
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			"Question generation failed. Please try again.",
		);
	}

	await recordAuditLog({
		action: "AI_QUIZ_GENERATED",
		entityType: "CourseMaterial",
		entityId: material.id,
		description: `${questions.length} questions from "${material.title}"`,
		actor: { userId: user.userId, email: user.email, role: user.role },
	});

	return {
		materialId: material.id,
		requested: payload.numberOfQuestions,
		questions,
		warnings,
	};
};

export const AiService = { generateQuiz };
