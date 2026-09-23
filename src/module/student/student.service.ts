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
import { STUDENT_SORTABLE_FIELDS } from "./student.constant";
import type {
	ICreateStudentPayload,
	IUpdateStudentPayload,
} from "./student.interface";

const RELATION_SELECT = {
	department: { select: { id: true, name: true, code: true } },
	admissionSemester: { select: { id: true, code: true, year: true } },
} satisfies Prisma.StudentInclude;

const assertDepartmentExists = async (departmentId: string) => {
	const department = await prisma.department.findFirst({
		where: { id: departmentId, deletedAt: null },
	});
	if (!department) {
		throw new AppError(httpStatus.NOT_FOUND, "Department not found.");
	}
};

const createStudent = async (payload: ICreateStudentPayload, actor: IActor) => {
	const email = payload.email.trim().toLowerCase();

	const [existingUser, department, semester] = await Promise.all([
		prisma.user.findUnique({ where: { email } }),
		prisma.department.findFirst({
			where: { id: payload.departmentId, deletedAt: null },
		}),
		prisma.semester.findFirst({
			where: { id: payload.admissionSemesterId, deletedAt: null },
		}),
	]);

	if (existingUser) {
		throw new AppError(
			httpStatus.CONFLICT,
			"An account with this email already exists.",
		);
	}
	if (!department) {
		throw new AppError(httpStatus.NOT_FOUND, "Department not found.");
	}
	if (!semester) {
		throw new AppError(httpStatus.NOT_FOUND, "Semester not found.");
	}

	const hashedPassword = await bcrypt.hash(
		payload.password,
		Number(config.bcrypt_salt_rounds),
	);
	const studentId = generateSequenceId("STU", semester.year);

	const user = await prisma.user.create({
		data: {
			email,
			password: hashedPassword,
			role: Role.STUDENT,
			student: {
				create: {
					studentId,
					name: payload.name,
					phone: payload.phone,
					dateOfBirth: payload.dateOfBirth,
					departmentId: department.id,
					admissionSemesterId: semester.id,
				},
			},
		},
		include: { student: { include: RELATION_SELECT } },
	});

	await recordAuditLog({
		action: "STUDENT_CREATED",
		entityType: "Student",
		entityId: user.student?.id,
		description: `${payload.name} (${email})`,
		actor,
	});

	return {
		id: user.student?.id,
		userId: user.id,
		email: user.email,
		...user.student,
	};
};

const getStudents = async (
	query: IQuery & { departmentId?: string; admissionSemesterId?: string },
) => {
	const { page, limit, skip, sortBy, sortOrder } = calculatePagination(
		query,
		STUDENT_SORTABLE_FIELDS,
	);

	const andConditions: Prisma.StudentWhereInput[] = [{ deletedAt: null }];
	if (query.departmentId) {
		andConditions.push({ departmentId: query.departmentId });
	}
	if (query.admissionSemesterId) {
		andConditions.push({ admissionSemesterId: query.admissionSemesterId });
	}
	if (query.searchTerm) {
		andConditions.push({
			OR: [
				{ name: { contains: query.searchTerm, mode: "insensitive" } },
				{ studentId: { contains: query.searchTerm, mode: "insensitive" } },
			],
		});
	}
	const where: Prisma.StudentWhereInput = { AND: andConditions };

	const [data, total] = await Promise.all([
		prisma.student.findMany({
			where,
			include: RELATION_SELECT,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
		}),
		prisma.student.count({ where }),
	]);

	return { data, meta: buildMeta(total, page, limit) };
};

const getStudentById = async (id: string, requester: IActor) => {
	const student = await prisma.student.findFirst({
		where: { id, deletedAt: null },
		include: RELATION_SELECT,
	});
	if (!student) {
		throw new AppError(httpStatus.NOT_FOUND, "Student not found.");
	}

	const isSelf =
		requester.role === Role.STUDENT && student.userId === requester.userId;
	if (requester.role === Role.STUDENT && !isSelf) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view your own student record.",
		);
	}

	return student;
};

const updateStudent = async (
	id: string,
	payload: IUpdateStudentPayload,
	actor: IActor,
) => {
	const student = await prisma.student.findFirst({
		where: { id, deletedAt: null },
	});
	if (!student) {
		throw new AppError(httpStatus.NOT_FOUND, "Student not found.");
	}

	if (payload.departmentId) {
		await assertDepartmentExists(payload.departmentId);
	}

	const updated = await prisma.student.update({
		where: { id },
		data: payload,
		include: RELATION_SELECT,
	});

	await recordAuditLog({
		action: "STUDENT_UPDATED",
		entityType: "Student",
		entityId: id,
		actor,
	});

	return updated;
};

const deleteStudent = async (id: string, actor: IActor) => {
	const student = await prisma.student.findFirst({
		where: { id, deletedAt: null },
	});
	if (!student) {
		throw new AppError(httpStatus.NOT_FOUND, "Student not found.");
	}

	const activeEnrollmentCount = await prisma.enrollment.count({
		where: {
			studentId: id,
			deletedAt: null,
			status: { in: ["PENDING", "ENROLLED"] },
		},
	});
	if (activeEnrollmentCount) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Cannot delete a student with active enrollments. Withdraw them first.",
		);
	}

	const now = new Date();
	await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
		await tx.student.update({ where: { id }, data: { deletedAt: now } });
		await tx.user.update({
			where: { id: student.userId },
			data: { deletedAt: now, isActive: false },
		});
	});

	await recordAuditLog({
		action: "STUDENT_DELETED",
		entityType: "Student",
		entityId: id,
		actor,
	});
};

export const StudentService = {
	createStudent,
	getStudents,
	getStudentById,
	updateStudent,
	deleteStudent,
};
