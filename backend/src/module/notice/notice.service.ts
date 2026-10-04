import { Role } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import httpStatus from "http-status";

import type { IActor, IQuery } from "../../interface";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../../utils/auditLog";
import { cacheGet, cacheInvalidateByPrefix, cacheSet } from "../../utils/cache";
import { buildMeta, calculatePagination } from "../../utils/paginationHelper";
import { NOTICE_SORTABLE_FIELDS } from "./notice.constant";
import type {
	ICreateNoticePayload,
	IUpdateNoticePayload,
} from "./notice.interface";

const CACHE_PREFIX = "notices:";
const CACHE_TTL_SECONDS = 120;

const visibleAudiencesFor = (role?: Role): Prisma.NoticeWhereInput => {
	if (role === Role.ADMIN) return {};
	if (role === Role.FACULTY) return { audience: { in: ["ALL", "FACULTY"] } };
	if (role === Role.STUDENT) return { audience: { in: ["ALL", "STUDENT"] } };
	return { audience: "ALL" };
};

const createNotice = async (payload: ICreateNoticePayload, actor: IActor) => {
	const notice = await prisma.notice.create({
		data: { ...payload, postedByUserId: actor.userId },
	});
	await cacheInvalidateByPrefix(CACHE_PREFIX);
	await recordAuditLog({
		action: "NOTICE_CREATED",
		entityType: "Notice",
		entityId: notice.id,
		description: notice.title,
		actor,
	});
	return notice;
};

const getNotices = async (query: IQuery, role?: Role) => {
	const { page, limit, skip, sortBy, sortOrder } = calculatePagination(
		query,
		NOTICE_SORTABLE_FIELDS,
	);
	const cacheKey = `${CACHE_PREFIX}${role ?? "anon"}:${JSON.stringify({ query, page, limit, sortBy, sortOrder })}`;
	const cached = await cacheGet<{
		data: unknown[];
		meta: ReturnType<typeof buildMeta>;
	}>(cacheKey);
	if (cached) return cached;

	const andConditions: Prisma.NoticeWhereInput[] = [
		{ deletedAt: null },
		visibleAudiencesFor(role),
	];
	if (query.searchTerm) {
		andConditions.push({
			OR: [
				{ title: { contains: query.searchTerm, mode: "insensitive" } },
				{ content: { contains: query.searchTerm, mode: "insensitive" } },
			],
		});
	}
	const where: Prisma.NoticeWhereInput = { AND: andConditions };

	const [data, total] = await Promise.all([
		prisma.notice.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
		}),
		prisma.notice.count({ where }),
	]);

	const result = { data, meta: buildMeta(total, page, limit) };
	await cacheSet(cacheKey, result, CACHE_TTL_SECONDS);
	return result;
};

const getNoticeById = async (id: string, role?: Role) => {
	const notice = await prisma.notice.findFirst({
		where: { id, deletedAt: null, AND: [visibleAudiencesFor(role)] },
	});
	if (!notice) {
		throw new AppError(httpStatus.NOT_FOUND, "Notice not found.");
	}
	return notice;
};

const updateNotice = async (
	id: string,
	payload: IUpdateNoticePayload,
	actor: IActor,
) => {
	const notice = await prisma.notice.findFirst({
		where: { id, deletedAt: null },
	});
	if (!notice) {
		throw new AppError(httpStatus.NOT_FOUND, "Notice not found.");
	}

	const updated = await prisma.notice.update({ where: { id }, data: payload });
	await cacheInvalidateByPrefix(CACHE_PREFIX);
	await recordAuditLog({
		action: "NOTICE_UPDATED",
		entityType: "Notice",
		entityId: id,
		actor,
	});

	return updated;
};

const deleteNotice = async (id: string, actor: IActor) => {
	const notice = await prisma.notice.findFirst({
		where: { id, deletedAt: null },
	});
	if (!notice) {
		throw new AppError(httpStatus.NOT_FOUND, "Notice not found.");
	}

	await prisma.notice.update({
		where: { id },
		data: { deletedAt: new Date() },
	});
	await cacheInvalidateByPrefix(CACHE_PREFIX);
	await recordAuditLog({
		action: "NOTICE_DELETED",
		entityType: "Notice",
		entityId: id,
		actor,
	});
};

export const NoticeService = {
	createNotice,
	getNotices,
	getNoticeById,
	updateNotice,
	deleteNotice,
};
