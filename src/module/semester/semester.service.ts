import type { Prisma, SemesterStatus } from "@prisma/client";
import httpStatus from "http-status";

import type { IActor, IQuery } from "../../interface";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../../utils/auditLog";
import { cacheGet, cacheInvalidateByPrefix, cacheSet } from "../../utils/cache";
import { buildMeta, calculatePagination } from "../../utils/paginationHelper";
import { SEMESTER_SORTABLE_FIELDS } from "./semester.constant";
import type {
	ICreateSemesterPayload,
	IUpdateSemesterPayload,
} from "./semester.interface";

const CACHE_PREFIX = "semesters:";
const CACHE_TTL_SECONDS = 600;

const createSemester = async (
	payload: ICreateSemesterPayload,
	actor: IActor,
) => {
	const existing = await prisma.semester.findUnique({
		where: { code: payload.code },
	});
	if (existing) {
		throw new AppError(
			httpStatus.CONFLICT,
			"A semester with this code already exists.",
		);
	}

	const semester = await prisma.semester.create({ data: payload });
	await cacheInvalidateByPrefix(CACHE_PREFIX);
	await recordAuditLog({
		action: "SEMESTER_CREATED",
		entityType: "Semester",
		entityId: semester.id,
		description: semester.code,
		actor,
	});

	return semester;
};

const getSemesters = async (query: IQuery & { status?: string }) => {
	const { page, limit, skip, sortBy, sortOrder } = calculatePagination(
		query,
		SEMESTER_SORTABLE_FIELDS,
	);
	const cacheKey = `${CACHE_PREFIX}${JSON.stringify({ query, page, limit, sortBy, sortOrder })}`;
	const cached = await cacheGet<{
		data: unknown[];
		meta: ReturnType<typeof buildMeta>;
	}>(cacheKey);
	if (cached) return cached;

	const andConditions: Prisma.SemesterWhereInput[] = [{ deletedAt: null }];
	if (query.status) {
		andConditions.push({ status: query.status as SemesterStatus });
	}
	if (query.searchTerm) {
		andConditions.push({
			code: { contains: query.searchTerm, mode: "insensitive" },
		});
	}
	const where: Prisma.SemesterWhereInput = { AND: andConditions };

	const [data, total] = await Promise.all([
		prisma.semester.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
		}),
		prisma.semester.count({ where }),
	]);

	const result = { data, meta: buildMeta(total, page, limit) };
	await cacheSet(cacheKey, result, CACHE_TTL_SECONDS);
	return result;
};

const getSemesterById = async (id: string) => {
	const semester = await prisma.semester.findFirst({
		where: { id, deletedAt: null },
	});
	if (!semester) {
		throw new AppError(httpStatus.NOT_FOUND, "Semester not found.");
	}
	return semester;
};

const updateSemester = async (
	id: string,
	payload: IUpdateSemesterPayload,
	actor: IActor,
) => {
	await getSemesterById(id);

	if (payload.code) {
		const conflict = await prisma.semester.findFirst({
			where: { code: payload.code, id: { not: id } },
		});
		if (conflict) {
			throw new AppError(
				httpStatus.CONFLICT,
				"A semester with this code already exists.",
			);
		}
	}

	const updated = await prisma.semester.update({
		where: { id },
		data: payload,
	});
	await cacheInvalidateByPrefix(CACHE_PREFIX);
	await recordAuditLog({
		action: "SEMESTER_UPDATED",
		entityType: "Semester",
		entityId: id,
		actor,
	});

	return updated;
};

const deleteSemester = async (id: string, actor: IActor) => {
	await getSemesterById(id);

	const [offeringCount, studentCount, paymentCount] = await Promise.all([
		prisma.courseOffering.count({ where: { semesterId: id, deletedAt: null } }),
		prisma.student.count({
			where: { admissionSemesterId: id, deletedAt: null },
		}),
		prisma.payment.count({ where: { semesterId: id, deletedAt: null } }),
	]);

	if (offeringCount || studentCount || paymentCount) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Cannot delete a semester with course offerings, admitted students, or payments tied to it.",
		);
	}

	await prisma.semester.update({
		where: { id },
		data: { deletedAt: new Date() },
	});
	await cacheInvalidateByPrefix(CACHE_PREFIX);
	await recordAuditLog({
		action: "SEMESTER_DELETED",
		entityType: "Semester",
		entityId: id,
		actor,
	});
};

export const SemesterService = {
	createSemester,
	getSemesters,
	getSemesterById,
	updateSemester,
	deleteSemester,
};
