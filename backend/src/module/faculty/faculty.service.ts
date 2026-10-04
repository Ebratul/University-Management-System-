import { Role } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import httpStatus from "http-status";

import config from "../../config";
import type { IActor, IQuery } from "../../interface";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../../utils/auditLog";
import { generateSequenceId } from "../../utils/generateId";
import { buildMeta, calculatePagination } from "../../utils/paginationHelper";
import { FACULTY_SORTABLE_FIELDS } from "./faculty.constant";
import type {
	ICreateFacultyPayload,
	IUpdateFacultyPayload,
} from "./faculty.interface";

const DEPARTMENT_SELECT = {
	department: { select: { id: true, name: true, code: true } },
};

const assertDepartmentExists = async (departmentId: string) => {
	const department = await prisma.department.findFirst({
		where: { id: departmentId, deletedAt: null },
	});
	if (!department) {
		throw new AppError(httpStatus.NOT_FOUND, "Department not found.");
	}
};

const createFaculty = async (payload: ICreateFacultyPayload, actor: IActor) => {
	const email = payload.email.trim().toLowerCase();
	await assertDepartmentExists(payload.departmentId);

	const existingUser = await prisma.user.findUnique({ where: { email } });
	if (existingUser) {
		throw new AppError(
			httpStatus.CONFLICT,
			"An account with this email already exists.",
		);
	}

	const hashedPassword = await bcrypt.hash(
		payload.password,
		Number(config.bcrypt_salt_rounds),
	);
	const facultyId = generateSequenceId("FAC", new Date().getFullYear());

	const user = await prisma.user.create({
		data: {
			email,
			password: hashedPassword,
			role: Role.FACULTY,
			faculty: {
				create: {
					facultyId,
					name: payload.name,
					phone: payload.phone,
					designation: payload.designation,
					departmentId: payload.departmentId,
				},
			},
		},
		include: { faculty: { include: DEPARTMENT_SELECT } },
	});

	await recordAuditLog({
		action: "FACULTY_CREATED",
		entityType: "Faculty",
		entityId: user.faculty?.id,
		description: `${payload.name} (${email})`,
		actor,
	});

	return {
		id: user.faculty?.id,
		userId: user.id,
		email: user.email,
		...user.faculty,
	};
};

const getFaculties = async (query: IQuery & { departmentId?: string }) => {
	const { page, limit, skip, sortBy, sortOrder } = calculatePagination(
		query,
		FACULTY_SORTABLE_FIELDS,
	);

	const andConditions: Prisma.FacultyWhereInput[] = [{ deletedAt: null }];
	if (query.departmentId) {
		andConditions.push({ departmentId: query.departmentId });
	}
	if (query.searchTerm) {
		andConditions.push({
			OR: [
				{ name: { contains: query.searchTerm, mode: "insensitive" } },
				{ facultyId: { contains: query.searchTerm, mode: "insensitive" } },
			],
		});
	}
	const where: Prisma.FacultyWhereInput = { AND: andConditions };

	const [data, total] = await Promise.all([
		prisma.faculty.findMany({
			where,
			include: DEPARTMENT_SELECT,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
		}),
		prisma.faculty.count({ where }),
	]);

	return { data, meta: buildMeta(total, page, limit) };
};

const getFacultyById = async (id: string) => {
	const faculty = await prisma.faculty.findFirst({
		where: { id, deletedAt: null },
		include: DEPARTMENT_SELECT,
	});
	if (!faculty) {
		throw new AppError(httpStatus.NOT_FOUND, "Faculty not found.");
	}
	return faculty;
};

const updateFaculty = async (
	id: string,
	payload: IUpdateFacultyPayload,
	actor: IActor,
) => {
	await getFacultyById(id);

	if (payload.departmentId) {
		await assertDepartmentExists(payload.departmentId);
	}

	const updated = await prisma.faculty.update({
		where: { id },
		data: payload,
		include: DEPARTMENT_SELECT,
	});

	await recordAuditLog({
		action: "FACULTY_UPDATED",
		entityType: "Faculty",
		entityId: id,
		actor,
	});

	return updated;
};

const deleteFaculty = async (id: string, actor: IActor) => {
	const faculty = await getFacultyById(id);

	const offeringCount = await prisma.courseOffering.count({
		where: { facultyId: id, deletedAt: null },
	});
	if (offeringCount) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Cannot delete a faculty with active course offerings. Reassign them first.",
		);
	}

	const now = new Date();
	await prisma.$transaction(async (tx) => {
		await tx.faculty.update({ where: { id }, data: { deletedAt: now } });
		await tx.user.update({
			where: { id: faculty.userId },
			data: { deletedAt: now, isActive: false },
		});
	});

	await recordAuditLog({
		action: "FACULTY_DELETED",
		entityType: "Faculty",
		entityId: id,
		actor,
	});
};

export const FacultyService = {
	createFaculty,
	getFaculties,
	getFacultyById,
	updateFaculty,
	deleteFaculty,
};
