import { Role } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import httpStatus from "http-status";

import type { IActor } from "../../interface";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../../utils/auditLog";
import { buildMeta, calculatePagination } from "../../utils/paginationHelper";
import { RESULT_SORTABLE_FIELDS } from "./result.constant";
import type {
	ICreateResultPayload,
	IResultListQuery,
	IUpdateResultPayload,
} from "./result.interface";

const RELATION_SELECT = {
	enrollment: {
		select: {
			id: true,
			status: true,
			student: {
				select: { id: true, studentId: true, name: true, userId: true },
			},
			courseOffering: {
				select: {
					id: true,
					facultyId: true,
					course: { select: { id: true, courseCode: true, title: true } },
					semester: { select: { id: true, code: true, year: true } },
				},
			},
		},
	},
} satisfies Prisma.ResultInclude;

const getFacultyScopeId = async (userId: string) => {
	const faculty = await prisma.faculty.findFirst({
		where: { userId, deletedAt: null },
	});
	return faculty?.id;
};

const assertFacultyOwnsOffering = async (actor: IActor, facultyId: string) => {
	if (actor.role !== Role.FACULTY) return;
	const scopeId = await getFacultyScopeId(actor.userId);
	if (!scopeId || scopeId !== facultyId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only manage results for offerings you teach.",
		);
	}
};

const publishResult = async (payload: ICreateResultPayload, actor: IActor) => {
	const enrollment = await prisma.enrollment.findFirst({
		where: { id: payload.enrollmentId, deletedAt: null },
		include: { courseOffering: true, result: true },
	});
	if (!enrollment) {
		throw new AppError(httpStatus.NOT_FOUND, "Enrollment not found.");
	}
	if (enrollment.result) {
		throw new AppError(
			httpStatus.CONFLICT,
			"A result already exists for this enrollment. Use the update endpoint instead.",
		);
	}

	await assertFacultyOwnsOffering(actor, enrollment.courseOffering.facultyId);

	const result = await prisma.$transaction(async (tx) => {
		const created = await tx.result.create({
			data: {
				enrollmentId: enrollment.id,
				grade: payload.grade,
				gradePoint: payload.gradePoint,
			},
			include: RELATION_SELECT,
		});
		await tx.enrollment.update({
			where: { id: enrollment.id },
			data: { status: "COMPLETED" },
		});
		return created;
	});

	await recordAuditLog({
		action: "RESULT_PUBLISHED",
		entityType: "Result",
		entityId: result.id,
		description: `Grade ${result.grade} for enrollment ${enrollment.id}`,
		actor,
	});

	return result;
};

const listResults = async (query: IResultListQuery, requester: IActor) => {
	const { page, limit, skip, sortBy, sortOrder } = calculatePagination(
		query,
		RESULT_SORTABLE_FIELDS,
	);

	const andConditions: Prisma.ResultWhereInput[] = [{ deletedAt: null }];

	if (requester.role === Role.STUDENT) {
		const student = await prisma.student.findFirst({
			where: { userId: requester.userId, deletedAt: null },
		});
		if (!student)
			throw new AppError(httpStatus.FORBIDDEN, "Student profile not found.");
		andConditions.push({ enrollment: { studentId: student.id } });
	} else if (requester.role === Role.FACULTY) {
		const facultyId = await getFacultyScopeId(requester.userId);
		if (!facultyId)
			throw new AppError(httpStatus.FORBIDDEN, "Faculty profile not found.");
		andConditions.push({ enrollment: { courseOffering: { facultyId } } });
	} else if (query.studentId) {
		andConditions.push({ enrollment: { studentId: query.studentId } });
	}

	if (query.semesterId) {
		andConditions.push({
			enrollment: { courseOffering: { semesterId: query.semesterId } },
		});
	}
	if (query.courseOfferingId) {
		andConditions.push({
			enrollment: { courseOfferingId: query.courseOfferingId },
		});
	}

	const where: Prisma.ResultWhereInput = { AND: andConditions };

	const [data, total] = await Promise.all([
		prisma.result.findMany({
			where,
			include: RELATION_SELECT,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
		}),
		prisma.result.count({ where }),
	]);

	return { data, meta: buildMeta(total, page, limit) };
};

const getResultById = async (id: string, requester: IActor) => {
	const result = await prisma.result.findFirst({
		where: { id, deletedAt: null },
		include: RELATION_SELECT,
	});
	if (!result) {
		throw new AppError(httpStatus.NOT_FOUND, "Result not found.");
	}

	if (
		requester.role === Role.STUDENT &&
		result.enrollment.student.userId !== requester.userId
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view your own results.",
		);
	}
	if (requester.role === Role.FACULTY) {
		await assertFacultyOwnsOffering(
			requester,
			result.enrollment.courseOffering.facultyId,
		);
	}

	return result;
};

const updateResult = async (
	id: string,
	payload: IUpdateResultPayload,
	actor: IActor,
) => {
	const result = await prisma.result.findFirst({
		where: { id, deletedAt: null },
		include: RELATION_SELECT,
	});
	if (!result) {
		throw new AppError(httpStatus.NOT_FOUND, "Result not found.");
	}

	await assertFacultyOwnsOffering(
		actor,
		result.enrollment.courseOffering.facultyId,
	);

	const updated = await prisma.result.update({
		where: { id },
		data: payload,
		include: RELATION_SELECT,
	});

	await recordAuditLog({
		action: "RESULT_UPDATED",
		entityType: "Result",
		entityId: id,
		actor,
	});

	return updated;
};

export const ResultService = {
	publishResult,
	listResults,
	getResultById,
	updateResult,
};
