import { Role } from "@prisma/client";
import type { EnrollmentStatus, Prisma } from "@prisma/client";
import httpStatus from "http-status";

import type { IActor } from "../../interface";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../../utils/auditLog";
import { buildMeta, calculatePagination } from "../../utils/paginationHelper";
import { runSerializable } from "../../utils/withTransaction";
import {
	ACTIVE_ENROLLMENT_STATUSES,
	ENROLLMENT_SORTABLE_FIELDS,
} from "./enrollment.constant";
import type {
	ICreateEnrollmentPayload,
	IEnrollmentListQuery,
	IUpdateEnrollmentStatusPayload,
} from "./enrollment.interface";

const RELATION_SELECT = {
	student: { select: { id: true, studentId: true, name: true, userId: true } },
	courseOffering: {
		select: {
			id: true,
			maxSeats: true,
			facultyId: true,
			course: { select: { id: true, courseCode: true, title: true } },
			semester: { select: { id: true, code: true, year: true } },
		},
	},
} satisfies Prisma.EnrollmentInclude;

const enroll = async (
	studentUserId: string,
	payload: ICreateEnrollmentPayload,
	actor: IActor,
) => {
	const student = await prisma.student.findFirst({
		where: { userId: studentUserId, deletedAt: null },
	});
	if (!student) {
		throw new AppError(httpStatus.NOT_FOUND, "Student profile not found.");
	}

	const enrollment = await runSerializable(async (tx) => {
		const offering = await tx.courseOffering.findFirst({
			where: { id: payload.courseOfferingId, deletedAt: null },
			include: { semester: true },
		});
		if (!offering) {
			throw new AppError(httpStatus.NOT_FOUND, "Course offering not found.");
		}
		if (offering.semester.status === "COMPLETED") {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"This semester has already ended.",
			);
		}

		const existing = await tx.enrollment.findUnique({
			where: {
				studentId_courseOfferingId: {
					studentId: student.id,
					courseOfferingId: offering.id,
				},
			},
		});
		if (existing && !existing.deletedAt && existing.status !== "DROPPED") {
			throw new AppError(
				httpStatus.CONFLICT,
				"You are already enrolled in this course offering.",
			);
		}

		const activeCount = await tx.enrollment.count({
			where: {
				courseOfferingId: offering.id,
				deletedAt: null,
				status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
			},
		});
		if (activeCount >= offering.maxSeats) {
			throw new AppError(
				httpStatus.CONFLICT,
				"No seats remaining for this course offering.",
			);
		}

		if (existing) {
			return tx.enrollment.update({
				where: { id: existing.id },
				data: { status: "PENDING", deletedAt: null },
				include: RELATION_SELECT,
			});
		}

		return tx.enrollment.create({
			data: {
				studentId: student.id,
				courseOfferingId: offering.id,
				status: "PENDING",
			},
			include: RELATION_SELECT,
		});
	});

	await recordAuditLog({
		action: "ENROLLMENT_CREATED",
		entityType: "Enrollment",
		entityId: enrollment.id,
		actor,
	});

	return enrollment;
};

const assertScoped = async (requester: IActor) => {
	if (requester.role === Role.FACULTY) {
		const faculty = await prisma.faculty.findFirst({
			where: { userId: requester.userId, deletedAt: null },
		});
		return faculty?.id;
	}
	if (requester.role === Role.STUDENT) {
		const student = await prisma.student.findFirst({
			where: { userId: requester.userId, deletedAt: null },
		});
		return student?.id;
	}
	return undefined;
};

const listEnrollments = async (
	query: IEnrollmentListQuery,
	requester: IActor,
) => {
	const { page, limit, skip, sortBy, sortOrder } = calculatePagination(
		query,
		ENROLLMENT_SORTABLE_FIELDS,
	);

	const andConditions: Prisma.EnrollmentWhereInput[] = [{ deletedAt: null }];

	if (requester.role === Role.FACULTY) {
		const facultyId = await assertScoped(requester);
		if (!facultyId)
			throw new AppError(httpStatus.FORBIDDEN, "Faculty profile not found.");
		andConditions.push({ courseOffering: { facultyId } });
	} else if (requester.role === Role.STUDENT) {
		const studentId = await assertScoped(requester);
		if (!studentId)
			throw new AppError(httpStatus.FORBIDDEN, "Student profile not found.");
		andConditions.push({ studentId });
	} else if (query.studentId) {
		andConditions.push({ studentId: query.studentId });
	}

	if (query.status) andConditions.push({ status: query.status as EnrollmentStatus });
	if (query.courseOfferingId)
		andConditions.push({ courseOfferingId: query.courseOfferingId });

	const where: Prisma.EnrollmentWhereInput = { AND: andConditions };

	const [data, total] = await Promise.all([
		prisma.enrollment.findMany({
			where,
			include: RELATION_SELECT,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
		}),
		prisma.enrollment.count({ where }),
	]);

	return { data, meta: buildMeta(total, page, limit) };
};

const getEnrollmentById = async (id: string, requester: IActor) => {
	const enrollment = await prisma.enrollment.findFirst({
		where: { id, deletedAt: null },
		include: RELATION_SELECT,
	});
	if (!enrollment) {
		throw new AppError(httpStatus.NOT_FOUND, "Enrollment not found.");
	}

	if (
		requester.role === Role.STUDENT &&
		enrollment.student.userId !== requester.userId
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view your own enrollments.",
		);
	}
	if (requester.role === Role.FACULTY) {
		const facultyId = await assertScoped(requester);
		if (enrollment.courseOffering.facultyId !== facultyId) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You can only view enrollments in offerings you teach.",
			);
		}
	}

	return enrollment;
};

const updateStatus = async (
	id: string,
	payload: IUpdateEnrollmentStatusPayload,
	actor: IActor,
) => {
	const enrollment = await prisma.enrollment.findFirst({
		where: { id, deletedAt: null },
		include: RELATION_SELECT,
	});
	if (!enrollment) {
		throw new AppError(httpStatus.NOT_FOUND, "Enrollment not found.");
	}

	if (actor.role === Role.FACULTY) {
		const facultyId = await assertScoped(actor);
		if (enrollment.courseOffering.facultyId !== facultyId) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You can only manage enrollments in offerings you teach.",
			);
		}
	}

	const movingToActive = (
		ACTIVE_ENROLLMENT_STATUSES as readonly string[]
	).includes(payload.status);
	const wasActive = (ACTIVE_ENROLLMENT_STATUSES as readonly string[]).includes(
		enrollment.status,
	);

	const updated = await runSerializable(async (tx) => {
		if (movingToActive && !wasActive) {
			const activeCount = await tx.enrollment.count({
				where: {
					courseOfferingId: enrollment.courseOfferingId,
					deletedAt: null,
					status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
				},
			});
			if (activeCount >= enrollment.courseOffering.maxSeats) {
				throw new AppError(
					httpStatus.CONFLICT,
					"No seats remaining for this course offering.",
				);
			}
		}

		return tx.enrollment.update({
			where: { id },
			data: { status: payload.status },
			include: RELATION_SELECT,
		});
	});

	await recordAuditLog({
		action: "ENROLLMENT_STATUS_UPDATED",
		entityType: "Enrollment",
		entityId: id,
		description: `${enrollment.status} -> ${payload.status}`,
		actor,
	});

	return updated;
};

export const EnrollmentService = {
	enroll,
	listEnrollments,
	getEnrollmentById,
	updateStatus,
};
