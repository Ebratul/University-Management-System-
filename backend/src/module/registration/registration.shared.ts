import type { Prisma, Role } from "@prisma/client";
import httpStatus from "http-status";

import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { calculateFees, type TFeeBreakdown } from "./registration.calc";
import { getWindowState, windowMessage } from "./registration.window";

export type Tx = Prisma.TransactionClient;

// A student can hold one registration per semester while it is in any of these.
export const LIVE_REGISTRATION_STATUSES = [
	"SUBMITTED",
	"PAYMENT_PENDING",
	"PAID",
	"CONFIRMED",
] as const;

// Enrollment statuses that occupy a seat (same rule as the direct-enrol flow).
export const SEAT_STATUSES = ["PENDING", "ENROLLED"] as const;

export const REGISTRATION_INCLUDE = {
	student: {
		select: {
			id: true,
			studentId: true,
			registrationNumber: true,
			name: true,
			userId: true,
			currentSemesterLevel: true,
			department: { select: { id: true, name: true, code: true } },
			user: { select: { imageUrl: true } },
		},
	},
	semester: { select: { id: true, code: true, year: true, status: true } },
	items: {
		orderBy: { courseCode: "asc" },
		include: {
			courseOffering: {
				select: { id: true, faculty: { select: { id: true, name: true } } },
			},
		},
	},
	invoice: {
		include: {
			payments: {
				orderBy: { createdAt: "desc" },
				select: {
					id: true,
					status: true,
					amount: true,
					transactionId: true,
					paidAt: true,
					failureReason: true,
					createdAt: true,
				},
			},
		},
	},
} satisfies Prisma.CourseRegistrationInclude;

export type TRegistration = Prisma.CourseRegistrationGetPayload<{
	include: typeof REGISTRATION_INCLUDE;
}>;

// ---------------------------------------------------------------- issues

export type TIssueCode =
	| "REGISTRATION_NOT_OPEN"
	| "REGISTRATION_CLOSED"
	| "SEMESTER_ENDED"
	| "INVALID_OFFERING"
	| "REGISTRATION_DISABLED"
	| "NOT_ELIGIBLE_DEPARTMENT"
	| "NOT_ELIGIBLE_SEMESTER"
	| "ALREADY_COMPLETED"
	| "ALREADY_REGISTERED"
	| "DUPLICATE_COURSE"
	| "PREREQUISITE_MISSING"
	| "COURSE_FULL"
	| "CREDIT_MINIMUM"
	| "CREDIT_LIMIT_EXCEEDED"
	| "NO_COURSES"
	| "REGISTRATION_EXISTS";

export type TIssue = {
	offeringId: string | null;
	code: TIssueCode;
	message: string;
};

export const issuesToError = (issues: TIssue[]) =>
	new AppError(
		issues.some((i) => i.code === "COURSE_FULL")
			? httpStatus.CONFLICT
			: httpStatus.BAD_REQUEST,
		issues[0]?.message ?? "Registration cannot be submitted.",
		issues.map((i) => ({
			path: i.offeringId ?? "registration",
			message: i.message,
		})),
	);

// ----------------------------------------------------------- student facts

export const getStudentByUserId = async (userId: string) => {
	const student = await prisma.student.findFirst({
		where: { userId, deletedAt: null },
		select: {
			id: true,
			studentId: true,
			name: true,
			userId: true,
			departmentId: true,
			currentSemesterLevel: true,
		},
	});
	if (!student) {
		throw new AppError(httpStatus.NOT_FOUND, "Student profile not found.");
	}
	return student;
};

export type TStudent = Awaited<ReturnType<typeof getStudentByUserId>>;

/** Courses the student has finished with a passing grade (grade point above 0). */
export const passedCourseIds = async (tx: Tx, studentId: string) => {
	const rows = await tx.enrollment.findMany({
		where: {
			studentId,
			deletedAt: null,
			status: "COMPLETED",
			result: { is: { gradePoint: { gt: 0 }, deletedAt: null } },
		},
		select: { courseOffering: { select: { courseId: true } } },
	});
	return new Set(rows.map((r) => r.courseOffering.courseId));
};

export const seatsTaken = async (tx: Tx, offeringIds: string[]) => {
	if (offeringIds.length === 0) return new Map<string, number>();
	const grouped = await tx.enrollment.groupBy({
		by: ["courseOfferingId"],
		where: {
			courseOfferingId: { in: offeringIds },
			deletedAt: null,
			status: { in: [...SEAT_STATUSES] },
		},
		_count: { _all: true },
	});
	return new Map(grouped.map((g) => [g.courseOfferingId, g._count._all]));
};

// ------------------------------------------------------- offering rules

export const OFFERING_INCLUDE = {
	course: {
		select: {
			id: true,
			courseCode: true,
			title: true,
			credits: true,
			courseType: true,
			description: true,
			departmentId: true,
			deletedAt: true,
			prerequisiteId: true,
			prerequisite: { select: { id: true, courseCode: true, title: true } },
		},
	},
	faculty: { select: { id: true, name: true } },
} satisfies Prisma.CourseOfferingInclude;

export type TOffering = Prisma.CourseOfferingGetPayload<{
	include: typeof OFFERING_INCLUDE;
}>;

/** Reasons an offering is not part of this student's registration at all. */
export const notEligibleReason = (
	student: TStudent,
	semesterId: string,
	o: TOffering,
): TIssue | null => {
	const code = `${o.course.courseCode}`;
	if (o.deletedAt || o.course.deletedAt || o.semesterId !== semesterId) {
		return {
			offeringId: o.id,
			code: "INVALID_OFFERING",
			message: `${code} is not offered in this semester.`,
		};
	}
	if (!o.registrationEnabled) {
		return {
			offeringId: o.id,
			code: "REGISTRATION_DISABLED",
			message: `Registration for ${code} is not open.`,
		};
	}
	if (o.course.departmentId !== student.departmentId) {
		return {
			offeringId: o.id,
			code: "NOT_ELIGIBLE_DEPARTMENT",
			message: `${code} is not offered to your department.`,
		};
	}
	if (
		o.semesterLevel !== null &&
		o.semesterLevel !== student.currentSemesterLevel
	) {
		return {
			offeringId: o.id,
			code: "NOT_ELIGIBLE_SEMESTER",
			message: `${code} is for semester ${o.semesterLevel}, not your current semester.`,
		};
	}
	return null;
};

export type TStudentContext = {
	passed: Set<string>;
	/** Offerings the student already holds a seat or a completed enrolment in. */
	heldOfferingIds: Set<string>;
	taken: Map<string, number>;
};

export const loadStudentContext = async (
	tx: Tx,
	studentId: string,
	offeringIds: string[],
): Promise<TStudentContext> => {
	const [passed, held, taken] = await Promise.all([
		passedCourseIds(tx, studentId),
		tx.enrollment.findMany({
			where: {
				studentId,
				courseOfferingId: { in: offeringIds },
				deletedAt: null,
				status: { in: ["PENDING", "ENROLLED", "COMPLETED"] },
			},
			select: { courseOfferingId: true },
		}),
		seatsTaken(tx, offeringIds),
	]);
	return {
		passed,
		heldOfferingIds: new Set(held.map((h) => h.courseOfferingId)),
		taken,
	};
};

/** The first reason a student cannot pick an eligible offering, or null if they can. */
export const blockingReason = (
	ctx: TStudentContext,
	o: TOffering,
): TIssue | null => {
	const code = o.course.courseCode;
	if (ctx.passed.has(o.course.id)) {
		return {
			offeringId: o.id,
			code: "ALREADY_COMPLETED",
			message: `You have already completed ${code}.`,
		};
	}
	if (ctx.heldOfferingIds.has(o.id)) {
		return {
			offeringId: o.id,
			code: "ALREADY_REGISTERED",
			message: `You are already registered for ${code}.`,
		};
	}
	if (o.course.prerequisiteId && !ctx.passed.has(o.course.prerequisiteId)) {
		const pre = o.course.prerequisite;
		return {
			offeringId: o.id,
			code: "PREREQUISITE_MISSING",
			message: `${code} requires ${pre?.courseCode ?? "a prerequisite course"}, which you have not completed.`,
		};
	}
	if ((ctx.taken.get(o.id) ?? 0) >= o.maxSeats) {
		return {
			offeringId: o.id,
			code: "COURSE_FULL",
			message: `${code} is full.`,
		};
	}
	return null;
};

// ------------------------------------------------------------------ quote

export type TQuote = {
	semester: {
		id: string;
		code: string;
		year: number;
		status: string;
	};
	windowState: ReturnType<typeof getWindowState>;
	isLate: boolean;
	offerings: TOffering[];
	fees: TFeeBreakdown;
	minCredits: number;
	maxCredits: number;
	issues: TIssue[];
};

/**
 * Validates a selection and prices it. Everything comes from the database:
 * nothing about credits, types, rates or eligibility is taken from the client.
 * Problems are collected, not thrown, so a preview can show all of them.
 */
export const buildQuote = async (
	tx: Tx,
	student: TStudent,
	semesterId: string,
	offeringIds: string[],
	now: Date = new Date(),
): Promise<TQuote> => {
	const semester = await tx.semester.findFirst({
		where: { id: semesterId, deletedAt: null },
		include: { registrationSetting: true },
	});
	if (!semester)
		throw new AppError(httpStatus.NOT_FOUND, "Semester not found.");

	const setting = semester.registrationSetting;
	const issues: TIssue[] = [];

	const state = getWindowState(setting, now);
	const message = windowMessage(state, setting);
	if (message || !setting) {
		issues.push({
			offeringId: null,
			code:
				state === "CLOSED" ? "REGISTRATION_CLOSED" : "REGISTRATION_NOT_OPEN",
			message: message ?? "Registration is not open for this semester.",
		});
	}
	if (semester.status === "COMPLETED") {
		issues.push({
			offeringId: null,
			code: "SEMESTER_ENDED",
			message: "This semester has already ended.",
		});
	}
	if (offeringIds.length === 0) {
		issues.push({
			offeringId: null,
			code: "NO_COURSES",
			message: "Select at least one course.",
		});
	}

	const offerings = await tx.courseOffering.findMany({
		where: { id: { in: offeringIds } },
		include: OFFERING_INCLUDE,
	});
	const byId = new Map(offerings.map((o) => [o.id, o]));
	const ctx = await loadStudentContext(tx, student.id, offeringIds);

	const valid: TOffering[] = [];
	const seenCourses = new Set<string>();
	for (const id of offeringIds) {
		const o = byId.get(id);
		if (!o) {
			issues.push({
				offeringId: id,
				code: "INVALID_OFFERING",
				message: "One of the selected courses does not exist.",
			});
			continue;
		}
		const problem =
			notEligibleReason(student, semesterId, o) ?? blockingReason(ctx, o);
		if (problem) {
			issues.push(problem);
			continue;
		}
		if (seenCourses.has(o.course.id)) {
			issues.push({
				offeringId: o.id,
				code: "DUPLICATE_COURSE",
				message: `${o.course.courseCode} is selected more than once.`,
			});
			continue;
		}
		seenCourses.add(o.course.id);
		valid.push(o);
	}

	const rates = {
		theoryRate: setting?.theoryRate ?? 0,
		practicalRate: setting?.practicalRate ?? 0,
		otherRate: setting?.otherRate ?? 0,
		registrationFee: setting?.registrationFee ?? 0,
		lateFee: setting?.lateFee ?? 0,
	};
	const isLate = state === "LATE";
	const fees = calculateFees(
		valid.map((o) => ({
			offeringId: o.id,
			credits: o.course.credits,
			courseType: o.course.courseType,
		})),
		rates,
		isLate,
	);

	const minCredits = setting?.minCredits ?? 0;
	const maxCredits = setting?.maxCredits ?? 0;
	if (valid.length > 0) {
		if (minCredits > 0 && fees.totalCredits < minCredits) {
			issues.push({
				offeringId: null,
				code: "CREDIT_MINIMUM",
				message: `You must register at least ${minCredits} credits (you selected ${fees.totalCredits}).`,
			});
		}
		if (maxCredits > 0 && fees.totalCredits > maxCredits) {
			issues.push({
				offeringId: null,
				code: "CREDIT_LIMIT_EXCEEDED",
				message: `You can register at most ${maxCredits} credits (you selected ${fees.totalCredits}).`,
			});
		}
	}

	return {
		semester: {
			id: semester.id,
			code: semester.code,
			year: semester.year,
			status: semester.status,
		},
		windowState: state,
		isLate,
		offerings: valid,
		fees,
		minCredits,
		maxCredits,
		issues,
	};
};

// ----------------------------------------------------------------- expiry

/**
 * Unpaid invoices past their due date expire: the registration is closed and
 * its seats go back to the pool. Run lazily before any registration request
 * (the API runs serverless, so there is no background timer to rely on).
 * Invoices with a payment in progress (status PENDING) are never touched.
 */
export const expireStaleInvoices = async (): Promise<number> => {
	const stale = await prisma.registrationInvoice.findMany({
		where: {
			status: { in: ["UNPAID", "FAILED"] },
			expiresAt: { lt: new Date() },
			registration: { status: { in: ["SUBMITTED", "PAYMENT_PENDING"] } },
		},
		select: { id: true, registrationId: true, studentId: true },
		take: 100,
	});

	let expired = 0;
	for (const invoice of stale) {
		const done = await prisma.$transaction(async (tx) => {
			const claimed = await tx.registrationInvoice.updateMany({
				where: { id: invoice.id, status: { in: ["UNPAID", "FAILED"] } },
				data: { status: "EXPIRED" },
			});
			if (claimed.count === 0) return false;
			await releaseRegistration(tx, invoice.registrationId, "EXPIRED");
			return true;
		});
		if (done) expired += 1;
	}
	return expired;
};

/** Closes a registration and gives its reserved seats back. */
export const releaseRegistration = async (
	tx: Tx,
	registrationId: string,
	status: "CANCELLED" | "REJECTED" | "EXPIRED",
	reason?: string,
) => {
	const registration = await tx.courseRegistration.update({
		where: { id: registrationId },
		data: {
			status,
			cancelledAt: new Date(),
			cancelReason:
				reason ?? (status === "EXPIRED" ? "Invoice expired unpaid." : null),
		},
		include: { items: { select: { courseOfferingId: true } } },
	});
	await tx.enrollment.updateMany({
		where: {
			studentId: registration.studentId,
			courseOfferingId: {
				in: registration.items.map((i) => i.courseOfferingId),
			},
			status: "PENDING",
		},
		data: { status: "DROPPED" },
	});
};

// ---------------------------------------------------------- authorization

export const loadRegistrationFor = async (
	registrationId: string,
	requester: { userId: string; role: Role },
): Promise<TRegistration> => {
	const registration = await prisma.courseRegistration.findUnique({
		where: { id: registrationId },
		include: REGISTRATION_INCLUDE,
	});
	if (!registration) {
		throw new AppError(httpStatus.NOT_FOUND, "Registration not found.");
	}
	if (
		requester.role === "STUDENT" &&
		registration.student.userId !== requester.userId
	) {
		// Not "forbidden": do not even confirm that another student's id exists.
		throw new AppError(httpStatus.NOT_FOUND, "Registration not found.");
	}
	return registration;
};
