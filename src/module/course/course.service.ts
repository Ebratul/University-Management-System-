import type { Prisma } from "@prisma/client";
import httpStatus from "http-status";

import type { IActor, IQuery } from "../../interface";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../../utils/auditLog";
import { cacheGet, cacheInvalidateByPrefix, cacheSet } from "../../utils/cache";
import { buildMeta, calculatePagination } from "../../utils/paginationHelper";
import { COURSE_SORTABLE_FIELDS } from "./course.constant";
import type {
	ICreateCoursePayload,
	IUpdateCoursePayload,
} from "./course.interface";

const CACHE_PREFIX = "courses:";
const CACHE_TTL_SECONDS = 300;

const assertDepartmentExists = async (departmentId: string) => {
	const department = await prisma.department.findFirst({
		where: { id: departmentId, deletedAt: null },
	});
	if (!department) {
		throw new AppError(httpStatus.NOT_FOUND, "Department not found.");
	}
};

const createCourse = async (payload: ICreateCoursePayload, actor: IActor) => {
	await assertDepartmentExists(payload.departmentId);

	const existing = await prisma.course.findUnique({
		where: { courseCode: payload.courseCode },
	});
	if (existing) {
		throw new AppError(
			httpStatus.CONFLICT,
			"A course with this course code already exists.",
		);
	}

	const course = await prisma.course.create({ data: payload });
	await cacheInvalidateByPrefix(CACHE_PREFIX);
	await recordAuditLog({
		action: "COURSE_CREATED",
		entityType: "Course",
		entityId: course.id,
		description: course.courseCode,
		actor,
	});

	return course;
};

const getCourses = async (query: IQuery & { departmentId?: string }) => {
	const { page, limit, skip, sortBy, sortOrder } = calculatePagination(
		query,
		COURSE_SORTABLE_FIELDS,
	);
	const cacheKey = `${CACHE_PREFIX}${JSON.stringify({ query, page, limit, sortBy, sortOrder })}`;
	const cached = await cacheGet<{
		data: unknown[];
		meta: ReturnType<typeof buildMeta>;
	}>(cacheKey);
	if (cached) return cached;

	const andConditions: Prisma.CourseWhereInput[] = [{ deletedAt: null }];
	if (query.departmentId) {
		andConditions.push({ departmentId: query.departmentId });
	}
	if (query.searchTerm) {
		andConditions.push({
			OR: [
				{ title: { contains: query.searchTerm, mode: "insensitive" } },
				{ courseCode: { contains: query.searchTerm, mode: "insensitive" } },
			],
		});
	}
	const where: Prisma.CourseWhereInput = { AND: andConditions };

	const [data, total] = await Promise.all([
		prisma.course.findMany({
			where,
			include: { department: { select: { id: true, name: true, code: true } } },
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
		}),
		prisma.course.count({ where }),
	]);

	const result = { data, meta: buildMeta(total, page, limit) };
	await cacheSet(cacheKey, result, CACHE_TTL_SECONDS);
	return result;
};

const getCourseById = async (id: string) => {
	const course = await prisma.course.findFirst({
		where: { id, deletedAt: null },
		include: { department: { select: { id: true, name: true, code: true } } },
	});
	if (!course) {
		throw new AppError(httpStatus.NOT_FOUND, "Course not found.");
	}
	return course;
};

const updateCourse = async (
	id: string,
	payload: IUpdateCoursePayload,
	actor: IActor,
) => {
	await getCourseById(id);

	if (payload.departmentId) {
		await assertDepartmentExists(payload.departmentId);
	}

	if (payload.courseCode) {
		const conflict = await prisma.course.findFirst({
			where: { courseCode: payload.courseCode, id: { not: id } },
		});
		if (conflict) {
			throw new AppError(
				httpStatus.CONFLICT,
				"A course with this course code already exists.",
			);
		}
	}

	const updated = await prisma.course.update({ where: { id }, data: payload });
	await cacheInvalidateByPrefix(CACHE_PREFIX);
	await recordAuditLog({
		action: "COURSE_UPDATED",
		entityType: "Course",
		entityId: id,
		actor,
	});

	return updated;
};

const deleteCourse = async (id: string, actor: IActor) => {
	await getCourseById(id);

	const offeringCount = await prisma.courseOffering.count({
		where: { courseId: id, deletedAt: null },
	});
	if (offeringCount) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Cannot delete a course with active offerings. Remove them first.",
		);
	}

	await prisma.course.update({
		where: { id },
		data: { deletedAt: new Date() },
	});
	await cacheInvalidateByPrefix(CACHE_PREFIX);
	await recordAuditLog({
		action: "COURSE_DELETED",
		entityType: "Course",
		entityId: id,
		actor,
	});
};

export const CourseService = {
	createCourse,
	getCourses,
	getCourseById,
	updateCourse,
	deleteCourse,
};
