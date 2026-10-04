import { PaymentStatus, type Prisma, Role } from "@prisma/client";

import { prisma } from "../../lib/prisma";
import { cacheGet, cacheSet } from "../../utils/cache";
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

const DASHBOARD_CACHE_KEY = "admin:dashboard-stats";
const DASHBOARD_CACHE_TTL_SECONDS = 60;

const getDashboardStats = async () => {
	const cached = await cacheGet<Record<string, unknown>>(DASHBOARD_CACHE_KEY);
	if (cached) return cached;

	const [
		usersByRole,
		totalDepartments,
		totalCourses,
		totalFaculties,
		totalStudents,
		totalNotices,
		activeEnrollments,
		pendingPayments,
		revenue,
	] = await Promise.all([
		prisma.user.groupBy({
			by: ["role"],
			where: { deletedAt: null },
			_count: { _all: true },
		}),
		prisma.department.count({ where: { deletedAt: null } }),
		prisma.course.count({ where: { deletedAt: null } }),
		prisma.faculty.count({ where: { deletedAt: null } }),
		prisma.student.count({ where: { deletedAt: null } }),
		prisma.notice.count({ where: { deletedAt: null } }),
		prisma.enrollment.count({
			where: { deletedAt: null, status: { in: ["PENDING", "ENROLLED"] } },
		}),
		prisma.payment.count({
			where: { deletedAt: null, status: PaymentStatus.PENDING },
		}),
		prisma.payment.aggregate({
			where: { deletedAt: null, status: PaymentStatus.PAID },
			_sum: { amount: true },
		}),
	]);

	const roleCounts = { [Role.ADMIN]: 0, [Role.FACULTY]: 0, [Role.STUDENT]: 0 };
	for (const row of usersByRole) {
		roleCounts[row.role] = row._count._all;
	}

	const stats = {
		users: {
			total: Object.values(roleCounts).reduce((a, b) => a + b, 0),
			byRole: roleCounts,
		},
		totalDepartments,
		totalCourses,
		totalFaculties,
		totalStudents,
		totalNotices,
		activeEnrollments,
		pendingPayments,
		totalRevenueCollected: revenue._sum.amount ?? 0,
		generatedAt: new Date().toISOString(),
	};

	await cacheSet(DASHBOARD_CACHE_KEY, stats, DASHBOARD_CACHE_TTL_SECONDS);
	return stats;
};

export const AdminService = { listAuditLogs, getDashboardStats };
