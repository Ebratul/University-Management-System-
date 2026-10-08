import type { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma";
import { buildMeta, calculatePagination } from "../../utils/paginationHelper";
import type { IRegistrationListQuery } from "./registration.interface";
import { toRegistrationDto } from "./registration.service";
import {
	expireStaleInvoices,
	REGISTRATION_INCLUDE,
} from "./registration.shared";

const SORTABLE_FIELDS = ["createdAt", "submittedAt", "totalCredits", "status"];

const buildWhere = (
	query: IRegistrationListQuery,
): Prisma.CourseRegistrationWhereInput => {
	const and: Prisma.CourseRegistrationWhereInput[] = [];
	if (query.semesterId) and.push({ semesterId: query.semesterId });
	if (query.status) and.push({ status: query.status as never });
	if (query.paymentStatus) {
		and.push({ invoice: { is: { status: query.paymentStatus as never } } });
	}
	if (query.departmentId)
		and.push({ student: { departmentId: query.departmentId } });
	if (query.courseId) {
		and.push({
			items: { some: { courseOffering: { courseId: query.courseId } } },
		});
	}
	const term = query.searchTerm?.trim();
	if (term) {
		and.push({
			OR: [
				{ registrationNo: { contains: term, mode: "insensitive" } },
				{ student: { name: { contains: term, mode: "insensitive" } } },
				{ student: { studentId: { contains: term, mode: "insensitive" } } },
				{
					student: {
						registrationNumber: { contains: term, mode: "insensitive" },
					},
				},
				{
					invoice: {
						is: { invoiceNo: { contains: term, mode: "insensitive" } },
					},
				},
			],
		});
	}
	return { AND: and };
};

const listRegistrations = async (query: IRegistrationListQuery) => {
	await expireStaleInvoices();
	const { page, limit, skip, sortBy, sortOrder } = calculatePagination(
		query,
		SORTABLE_FIELDS,
	);
	const where = buildWhere(query);
	const [rows, total] = await Promise.all([
		prisma.courseRegistration.findMany({
			where,
			include: REGISTRATION_INCLUDE,
			orderBy: { [sortBy]: sortOrder },
			skip,
			take: limit,
		}),
		prisma.courseRegistration.count({ where }),
	]);
	return {
		data: rows.map(toRegistrationDto),
		meta: buildMeta(total, page, limit),
	};
};

// Headline numbers for the same filters the list uses (status filters excluded,
// so the cards always describe the whole filtered population).
const getStats = async (query: IRegistrationListQuery) => {
	await expireStaleInvoices();
	const base = buildWhere({
		...query,
		status: undefined,
		paymentStatus: undefined,
	});

	const [byStatus, byInvoice, collected, credits, students] = await Promise.all(
		[
			prisma.courseRegistration.groupBy({
				by: ["status"],
				where: base,
				_count: { _all: true },
			}),
			prisma.registrationInvoice.groupBy({
				by: ["status"],
				where: { registration: base },
				_count: { _all: true },
			}),
			prisma.registrationInvoice.aggregate({
				where: { registration: base, status: "PAID" },
				_sum: { totalAmount: true },
			}),
			prisma.courseRegistration.aggregate({
				where: { AND: [base, { status: "CONFIRMED" }] },
				_sum: { totalCredits: true },
			}),
			prisma.courseRegistration.groupBy({
				by: ["studentId"],
				where: { AND: [base, { status: "CONFIRMED" }] },
			}),
		],
	);

	const statusCount = (s: string) =>
		byStatus.find((r) => r.status === s)?._count._all ?? 0;
	const invoiceCount = (...s: string[]) =>
		byInvoice
			.filter((r) => s.includes(r.status))
			.reduce((n, r) => n + r._count._all, 0);

	return {
		totalRegisteredStudents: students.length,
		totalConfirmed: statusCount("CONFIRMED"),
		totalPaid: invoiceCount("PAID"),
		totalUnpaid: invoiceCount("UNPAID", "FAILED"),
		totalPending: invoiceCount("PENDING"),
		totalCollected: collected._sum.totalAmount ?? 0, // paisa
		totalRegisteredCredits: credits._sum.totalCredits ?? 0,
		byStatus: Object.fromEntries(
			byStatus.map((r) => [r.status, r._count._all]),
		),
	};
};

export const RegistrationAdminService = { listRegistrations, getStats };
