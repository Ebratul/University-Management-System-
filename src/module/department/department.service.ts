import type { Prisma } from "@prisma/client";
import httpStatus from "http-status";

import type { IActor, IQuery } from "../../interface";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../../utils/auditLog";
import { cacheGet, cacheInvalidateByPrefix, cacheSet } from "../../utils/cache";
import { buildMeta, calculatePagination } from "../../utils/paginationHelper";
import { DEPARTMENT_SORTABLE_FIELDS } from "./department.constant";
import type {
	ICreateDepartmentPayload,
	IUpdateDepartmentPayload,
} from "./department.interface";

const CACHE_PREFIX = "departments:";
const CACHE_TTL_SECONDS = 600; // Departments change rarely; cache reads, invalidate on writes.

const createDepartment = async (
	payload: ICreateDepartmentPayload,
	actor: IActor,
) => {
	const existing = await prisma.department.findFirst({
		where: { OR: [{ name: payload.name }, { code: payload.code }] },
	});
	if (existing) {
		throw new AppError(
			httpStatus.CONFLICT,
			"A department with this name or code already exists.",
		);
	}

	const department = await prisma.department.create({ data: payload });
	await cacheInvalidateByPrefix(CACHE_PREFIX);
	await recordAuditLog({
		action: "DEPARTMENT_CREATED",
		entityType: "Department",
		entityId: department.id,
		description: department.name,
		actor,
	});

	return department;
};

const getDepartments = async (query: IQuery) => {
	const { page, limit, skip, sortBy, sortOrder } = calculatePagination(
		query,
		DEPARTMENT_SORTABLE_FIELDS,
	);
	const cacheKey = `${CACHE_PREFIX}${JSON.stringify({ query, page, limit, sortBy, sortOrder })}`;

	const cached = await cacheGet<{
		data: unknown[];
		meta: ReturnType<typeof buildMeta>;
	}>(cacheKey);
	if (cached) return cached;

	const andConditions: Prisma.DepartmentWhereInput[] = [{ deletedAt: null }];
	if (query.searchTerm) {
		andConditions.push({
			OR: [
				{ name: { contains: query.searchTerm, mode: "insensitive" } },
				{ code: { contains: query.searchTerm, mode: "insensitive" } },
			],
		});
	}
	const where: Prisma.DepartmentWhereInput = { AND: andConditions };

	const [data, total] = await Promise.all([
		prisma.department.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
		}),
		prisma.department.count({ where }),
	]);

	const result = { data, meta: buildMeta(total, page, limit) };
	await cacheSet(cacheKey, result, CACHE_TTL_SECONDS);
	return result;
};

const getDepartmentById = async (id: string) => {
	const department = await prisma.department.findFirst({
		where: { id, deletedAt: null },
	});
	if (!department) {
		throw new AppError(httpStatus.NOT_FOUND, "Department not found.");
	}
	return department;
};

const updateDepartment = async (
	id: string,
	payload: IUpdateDepartmentPayload,
	actor: IActor,
) => {
	await getDepartmentById(id);

	if (payload.name || payload.code) {
		const conflict = await prisma.department.findFirst({
			where: {
				id: { not: id },
				OR: [
					payload.name ? { name: payload.name } : undefined,
					payload.code ? { code: payload.code } : undefined,
				].filter(Boolean) as Prisma.DepartmentWhereInput[],
			},
		});
		if (conflict) {
			throw new AppError(
				httpStatus.CONFLICT,
				"A department with this name or code already exists.",
			);
		}
	}

	const updated = await prisma.department.update({
		where: { id },
		data: payload,
	});
	await cacheInvalidateByPrefix(CACHE_PREFIX);
	await recordAuditLog({
		action: "DEPARTMENT_UPDATED",
		entityType: "Department",
		entityId: id,
		actor,
	});

	return updated;
};

const deleteDepartment = async (id: string, actor: IActor) => {
	await getDepartmentById(id);

	const [facultyCount, courseCount, studentCount] = await Promise.all([
		prisma.faculty.count({ where: { departmentId: id, deletedAt: null } }),
		prisma.course.count({ where: { departmentId: id, deletedAt: null } }),
		prisma.student.count({ where: { departmentId: id, deletedAt: null } }),
	]);

	if (facultyCount || courseCount || studentCount) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Cannot delete a department with active faculty, courses, or students. Reassign or remove them first.",
		);
	}

	await prisma.department.update({
		where: { id },
		data: { deletedAt: new Date() },
	});
	await cacheInvalidateByPrefix(CACHE_PREFIX);
	await recordAuditLog({
		action: "DEPARTMENT_DELETED",
		entityType: "Department",
		entityId: id,
		actor,
	});
};

export const DepartmentService = {
	createDepartment,
	getDepartments,
	getDepartmentById,
	updateDepartment,
	deleteDepartment,
};
