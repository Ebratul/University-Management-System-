import type { Prisma } from "@prisma/client";
import httpStatus from "http-status";

import type { IActor, IQuery } from "../../interface";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../../utils/auditLog";
import { buildMeta, calculatePagination } from "../../utils/paginationHelper";
import {
	ACTIVE_ENROLLMENT_STATUSES,
	COURSE_OFFERING_SORTABLE_FIELDS,
} from "./course-offering.constant";
import type {
	IAssignFacultyPayload,
	ICreateCourseOfferingPayload,
	IUpdateCourseOfferingPayload,
} from "./course-offering.interface";

const RELATION_SELECT = {
	course: {
		select: { id: true, courseCode: true, title: true, credits: true },
	},
	faculty: { select: { id: true, facultyId: true, name: true } },
	semester: { select: { id: true, code: true, year: true, status: true } },
} satisfies Prisma.CourseOfferingInclude;

const withSeatsRemaining = async <T extends { id: string; maxSeats: number }>(
	offerings: T[],
) => {
	if (offerings.length === 0)
		return [] as (T & { enrolledCount: number; seatsRemaining: number })[];

	const counts = await prisma.enrollment.groupBy({
		by: ["courseOfferingId"],
		where: {
			courseOfferingId: { in: offerings.map((o) => o.id) },
			deletedAt: null,
			status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
		},
		_count: { _all: true },
	});
	const countMap = new Map(
		counts.map((c) => [c.courseOfferingId, c._count._all]),
	);

	return offerings.map((offering) => {
		const enrolledCount = countMap.get(offering.id) ?? 0;
		return {
			...offering,
			enrolledCount,
			seatsRemaining: offering.maxSeats - enrolledCount,
		};
	});
};

const assertExists = async (
	courseId: string,
	facultyId: string,
	semesterId: string,
) => {
	const [course, faculty, semester] = await Promise.all([
		prisma.course.findFirst({ where: { id: courseId, deletedAt: null } }),
		prisma.faculty.findFirst({ where: { id: facultyId, deletedAt: null } }),
		prisma.semester.findFirst({ where: { id: semesterId, deletedAt: null } }),
	]);
	if (!course) throw new AppError(httpStatus.NOT_FOUND, "Course not found.");
	if (!faculty) throw new AppError(httpStatus.NOT_FOUND, "Faculty not found.");
	if (!semester)
		throw new AppError(httpStatus.NOT_FOUND, "Semester not found.");
};

const createOffering = async (
	payload: ICreateCourseOfferingPayload,
	actor: IActor,
) => {
	await assertExists(payload.courseId, payload.facultyId, payload.semesterId);

	const existing = await prisma.courseOffering.findUnique({
		where: {
			courseId_semesterId_facultyId: {
				courseId: payload.courseId,
				semesterId: payload.semesterId,
				facultyId: payload.facultyId,
			},
		},
	});
	if (existing) {
		throw new AppError(
			httpStatus.CONFLICT,
			"This faculty already has an offering for this course in this semester.",
		);
	}

	const offering = await prisma.courseOffering.create({
		data: payload,
		include: RELATION_SELECT,
	});

	await recordAuditLog({
		action: "COURSE_OFFERING_CREATED",
		entityType: "CourseOffering",
		entityId: offering.id,
		actor,
	});

	return offering;
};

const getOfferings = async (
	query: IQuery & {
		semesterId?: string;
		courseId?: string;
		facultyId?: string;
	},
) => {
	const { page, limit, skip, sortBy, sortOrder } = calculatePagination(
		query,
		COURSE_OFFERING_SORTABLE_FIELDS,
	);

	const andConditions: Prisma.CourseOfferingWhereInput[] = [
		{ deletedAt: null },
	];
	if (query.semesterId) andConditions.push({ semesterId: query.semesterId });
	if (query.courseId) andConditions.push({ courseId: query.courseId });
	if (query.facultyId) andConditions.push({ facultyId: query.facultyId });
	const where: Prisma.CourseOfferingWhereInput = { AND: andConditions };

	const [offerings, total] = await Promise.all([
		prisma.courseOffering.findMany({
			where,
			include: RELATION_SELECT,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
		}),
		prisma.courseOffering.count({ where }),
	]);

	const data = await withSeatsRemaining(offerings);
	return { data, meta: buildMeta(total, page, limit) };
};

const getOfferingById = async (id: string) => {
	const offering = await prisma.courseOffering.findFirst({
		where: { id, deletedAt: null },
		include: RELATION_SELECT,
	});
	if (!offering) {
		throw new AppError(httpStatus.NOT_FOUND, "Course offering not found.");
	}
	const [withSeats] = await withSeatsRemaining([offering]);
	return withSeats;
};

const updateOffering = async (
	id: string,
	payload: IUpdateCourseOfferingPayload,
	actor: IActor,
) => {
	const offering = await prisma.courseOffering.findFirst({
		where: { id, deletedAt: null },
	});
	if (!offering) {
		throw new AppError(httpStatus.NOT_FOUND, "Course offering not found.");
	}

	const updated = await prisma.courseOffering.update({
		where: { id },
		data: payload,
		include: RELATION_SELECT,
	});

	await recordAuditLog({
		action: "COURSE_OFFERING_UPDATED",
		entityType: "CourseOffering",
		entityId: id,
		actor,
	});

	const [withSeats] = await withSeatsRemaining([updated]);
	return withSeats;
};

const assignFaculty = async (
	id: string,
	payload: IAssignFacultyPayload,
	actor: IActor,
) => {
	const offering = await prisma.courseOffering.findFirst({
		where: { id, deletedAt: null },
	});
	if (!offering) {
		throw new AppError(httpStatus.NOT_FOUND, "Course offering not found.");
	}

	const faculty = await prisma.faculty.findFirst({
		where: { id: payload.facultyId, deletedAt: null },
	});
	if (!faculty) {
		throw new AppError(httpStatus.NOT_FOUND, "Faculty not found.");
	}

	const conflict = await prisma.courseOffering.findUnique({
		where: {
			courseId_semesterId_facultyId: {
				courseId: offering.courseId,
				semesterId: offering.semesterId,
				facultyId: payload.facultyId,
			},
		},
	});
	if (conflict && conflict.id !== id) {
		throw new AppError(
			httpStatus.CONFLICT,
			"This faculty already has an offering for this course in this semester.",
		);
	}

	const updated = await prisma.courseOffering.update({
		where: { id },
		data: { facultyId: payload.facultyId },
		include: RELATION_SELECT,
	});

	await recordAuditLog({
		action: "COURSE_OFFERING_FACULTY_REASSIGNED",
		entityType: "CourseOffering",
		entityId: id,
		description: `Reassigned to faculty ${faculty.name} (${faculty.facultyId})`,
		actor,
	});

	return updated;
};

const deleteOffering = async (id: string, actor: IActor) => {
	const offering = await prisma.courseOffering.findFirst({
		where: { id, deletedAt: null },
	});
	if (!offering) {
		throw new AppError(httpStatus.NOT_FOUND, "Course offering not found.");
	}

	const activeCount = await prisma.enrollment.count({
		where: {
			courseOfferingId: id,
			deletedAt: null,
			status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
		},
	});
	if (activeCount) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Cannot delete an offering with active enrollments.",
		);
	}

	await prisma.courseOffering.update({
		where: { id },
		data: { deletedAt: new Date() },
	});
	await recordAuditLog({
		action: "COURSE_OFFERING_DELETED",
		entityType: "CourseOffering",
		entityId: id,
		actor,
	});
};

export const CourseOfferingService = {
	createOffering,
	getOfferings,
	getOfferingById,
	updateOffering,
	assignFaculty,
	deleteOffering,
};
