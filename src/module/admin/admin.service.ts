import type { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma";
import { buildMeta, calculatePagination } from "../../utils/paginationHelper";
import { AUDIT_LOG_SORTABLE_FIELDS } from "./admin.constant";
import type { IAuditLogListQuery } from "./admin.interface";

const listAuditLogs = async (query: IAuditLogListQuery) => {
	const { page, limit, skip, sortBy, sortOrder } = calculatePagination(
		query,
		AUDIT_LOG_SORTABLE_FIELDS,
	);

	const andConditions: Prisma.AuditLogWhereInput[] = [];
	if (query.action) andConditions.push({ action: query.action });
	if (query.entityType) andConditions.push({ entityType: query.entityType });
	if (query.entityId) andConditions.push({ entityId: query.entityId });
	if (query.performedByUserId) {
		andConditions.push({ performedByUserId: query.performedByUserId });
	}
	if (query.from || query.to) {
		andConditions.push({
			createdAt: {
				...(query.from ? { gte: new Date(query.from) } : {}),
				...(query.to ? { lte: new Date(query.to) } : {}),
			},
		});
	}

	const where: Prisma.AuditLogWhereInput = andConditions.length
		? { AND: andConditions }
		: {};

	const [data, total] = await Promise.all([
		prisma.auditLog.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
		}),
		prisma.auditLog.count({ where }),
	]);

	return { data, meta: buildMeta(total, page, limit) };
};

export const AdminService = { listAuditLogs };
