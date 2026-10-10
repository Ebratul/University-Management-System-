import { Prisma } from "@prisma/client";
import httpStatus from "http-status";

import type { IActor, IQuery } from "../../interface";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../../utils/auditLog";
import { buildMeta, calculatePagination } from "../../utils/paginationHelper";
import type {
	ICreateUniversityPayload,
	IUpdateUniversityPayload,
} from "./university.interface";

const SORTABLE_FIELDS = ["createdAt", "name"];

const CONFLICT_MESSAGE =
	"That name or email domain is already used by another university.";

// A domain may belong to exactly one university and one role. The columns are
// unique on their own; this also stops a student domain equalling any teacher
// domain (the database cannot express that across two columns).
const assertNoConflict = async (
	next: { name?: string; studentDomain: string; teacherDomain: string },
	exceptId?: string,
) => {
	if (next.studentDomain === next.teacherDomain) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"The student and teacher domains must be different.",
		);
	}
	const domains = [next.studentDomain, next.teacherDomain];
	const clash = await prisma.university.findFirst({
		where: {
			...(exceptId ? { id: { not: exceptId } } : {}),
			OR: [
				{ studentDomain: { in: domains } },
				{ teacherDomain: { in: domains } },
				...(next.name
					? [{ name: { equals: next.name, mode: "insensitive" as const } }]
					: []),
			],
		},
		select: { id: true },
	});
	if (clash) throw new AppError(httpStatus.CONFLICT, CONFLICT_MESSAGE);
};

const rethrowUnique = (error: unknown): never => {
	if (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === "P2002"
	) {
		throw new AppError(httpStatus.CONFLICT, CONFLICT_MESSAGE);
	}
	throw error;
};

const createUniversity = async (
	payload: ICreateUniversityPayload,
	actor: IActor,
) => {
	await assertNoConflict(payload);
	try {
		const university = await prisma.university.create({ data: payload });
		await recordAuditLog({
			action: "UNIVERSITY_CREATED",
			entityType: "University",
			entityId: university.id,
			description: `${university.name}: ${university.studentDomain}, ${university.teacherDomain}`,
			actor,
		});
		return university;
	} catch (error) {
		return rethrowUnique(error);
	}
};

const getUniversities = async (query: IQuery) => {
	const { page, limit, skip, sortBy, sortOrder } = calculatePagination(
		query,
		SORTABLE_FIELDS,
	);
	const where: Prisma.UniversityWhereInput = query.searchTerm
		? {
				OR: [
					{ name: { contains: query.searchTerm, mode: "insensitive" } },
					{
						studentDomain: { contains: query.searchTerm, mode: "insensitive" },
					},
					{
						teacherDomain: { contains: query.searchTerm, mode: "insensitive" },
					},
				],
			}
		: {};

	const [data, total] = await Promise.all([
		prisma.university.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
			include: { _count: { select: { departments: true } } },
		}),
		prisma.university.count({ where }),
	]);
	return { data, meta: buildMeta(total, page, limit) };
};

const getUniversityById = async (id: string) => {
	const university = await prisma.university.findUnique({ where: { id } });
	if (!university) {
		throw new AppError(httpStatus.NOT_FOUND, "University not found.");
	}
	return university;
};

const updateUniversity = async (
	id: string,
	payload: IUpdateUniversityPayload,
	actor: IActor,
) => {
	const current = await getUniversityById(id);
	await assertNoConflict(
		{
			name: payload.name,
			studentDomain: payload.studentDomain ?? current.studentDomain,
			teacherDomain: payload.teacherDomain ?? current.teacherDomain,
		},
		id,
	);
	try {
		const updated = await prisma.university.update({
			where: { id },
			data: payload,
		});
		await recordAuditLog({
			action: "UNIVERSITY_UPDATED",
			entityType: "University",
			entityId: id,
			description: `${updated.name}: ${updated.studentDomain}, ${updated.teacherDomain}, active=${updated.isActive}`,
			actor,
		});
		return updated;
	} catch (error) {
		return rethrowUnique(error);
	}
};

export const UniversityService = {
	createUniversity,
	getUniversities,
	getUniversityById,
	updateUniversity,
};
