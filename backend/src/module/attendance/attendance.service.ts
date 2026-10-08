import type { AttendanceStatus } from "@prisma/client";
import httpStatus from "http-status";

import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../../utils/auditLog";
import {
	requireStaffAccess,
	resolveOfferingAccess,
} from "../../utils/offeringAccess";
import type { IMarkAttendancePayload } from "./attendance.interface";

const DAY_MS = 24 * 60 * 60 * 1000;

const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const todayUtc = () => new Date().toISOString().slice(0, 10);

const STUDENT_SELECT = {
	id: true,
	studentId: true,
	registrationNumber: true,
	name: true,
	user: { select: { imageUrl: true } },
} as const;

const summarize = (present: number, absent: number) => {
	const total = present + absent;
	return {
		totalClasses: total,
		present,
		absent,
		percentage: total === 0 ? 0 : Math.round((present / total) * 1000) / 10,
	};
};

const getEnrolledStudents = (offeringId: string) =>
	prisma.enrollment.findMany({
		where: {
			courseOfferingId: offeringId,
			deletedAt: null,
			status: "ENROLLED",
			student: { deletedAt: null },
		},
		select: { student: { select: STUDENT_SELECT } },
		orderBy: { student: { registrationNumber: "asc" } },
	});

const flattenStudent = (student: {
	id: string;
	studentId: string;
	registrationNumber: string;
	name: string;
	user: { imageUrl: string };
}) => ({
	id: student.id,
	studentId: student.studentId,
	registrationNumber: student.registrationNumber,
	name: student.name,
	imageUrl: student.user.imageUrl,
});

// Teacher/admin: the class list for one day, with whatever was already marked.
const getRoster = async (
	offeringId: string,
	user: RequestUser,
	date: string | undefined,
) => {
	await requireStaffAccess(user, offeringId);
	const day = date ?? todayUtc();

	const [enrolled, marked] = await Promise.all([
		getEnrolledStudents(offeringId),
		prisma.attendance.findMany({
			where: { courseOfferingId: offeringId, date: toDate(day) },
			select: { studentId: true, status: true },
		}),
	]);
	const statusByStudent = new Map(marked.map((m) => [m.studentId, m.status]));

	return {
		date: day,
		alreadyMarked: marked.length > 0,
		students: enrolled.map(({ student }) => ({
			...flattenStudent(student),
			status: statusByStudent.get(student.id) ?? null,
		})),
	};
};

const markAttendance = async (
	offeringId: string,
	payload: IMarkAttendancePayload,
	user: RequestUser,
) => {
	await requireStaffAccess(user, offeringId);

	// Allow today in any timezone (UTC+14 is a day ahead of UTC), nothing later.
	if (toDate(payload.date).getTime() > Date.now() + DAY_MS) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Attendance cannot be marked for a future date.",
		);
	}

	const enrolled = await getEnrolledStudents(offeringId);
	const enrolledIds = new Set(enrolled.map((e) => e.student.id));
	const outsiders = payload.records.filter(
		(r) => !enrolledIds.has(r.studentId),
	);
	if (outsiders.length > 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Some students are not enrolled in this course.",
		);
	}

	const date = toDate(payload.date);
	// upsert on (course, student, date): marking the same day again corrects the
	// row instead of creating a duplicate.
	await prisma.$transaction(
		payload.records.map((record) =>
			prisma.attendance.upsert({
				where: {
					courseOfferingId_studentId_date: {
						courseOfferingId: offeringId,
						studentId: record.studentId,
						date,
					},
				},
				update: { status: record.status, markedByUserId: user.userId },
				create: {
					courseOfferingId: offeringId,
					studentId: record.studentId,
					date,
					status: record.status,
					markedByUserId: user.userId,
				},
			}),
		),
	);

	await recordAuditLog({
		action: "ATTENDANCE_MARKED",
		entityType: "CourseOffering",
		entityId: offeringId,
		description: `${payload.date}: ${payload.records.length} students`,
		actor: { userId: user.userId, email: user.email, role: user.role },
	});

	return getRoster(offeringId, user, payload.date);
};

// Teacher/admin: per-student totals across the whole course.
const getSummary = async (offeringId: string, user: RequestUser) => {
	await requireStaffAccess(user, offeringId);

	const [enrolled, grouped, classDays] = await Promise.all([
		getEnrolledStudents(offeringId),
		prisma.attendance.groupBy({
			by: ["studentId", "status"],
			where: { courseOfferingId: offeringId },
			_count: { _all: true },
		}),
		prisma.attendance.findMany({
			where: { courseOfferingId: offeringId },
			distinct: ["date"],
			select: { date: true },
		}),
	]);

	const counts = new Map<string, Record<AttendanceStatus, number>>();
	for (const row of grouped) {
		const entry = counts.get(row.studentId) ?? { PRESENT: 0, ABSENT: 0 };
		entry[row.status] = row._count._all;
		counts.set(row.studentId, entry);
	}

	return {
		totalClassDays: classDays.length,
		students: enrolled.map(({ student }) => {
			const c = counts.get(student.id) ?? { PRESENT: 0, ABSENT: 0 };
			return {
				...flattenStudent(student),
				...summarize(c.PRESENT, c.ABSENT),
			};
		}),
	};
};

const getStudentRecords = async (offeringId: string, studentId: string) => {
	const records = await prisma.attendance.findMany({
		where: { courseOfferingId: offeringId, studentId },
		select: { date: true, status: true },
		orderBy: { date: "desc" },
	});
	const present = records.filter((r) => r.status === "PRESENT").length;
	return {
		...summarize(present, records.length - present),
		records: records.map((r) => ({
			date: r.date.toISOString().slice(0, 10),
			status: r.status,
		})),
	};
};

// A student sees only their own attendance; their id comes from the session.
const getMyAttendance = async (offeringId: string, user: RequestUser) => {
	const access = await resolveOfferingAccess(user, offeringId);
	if (access.kind !== "student" || !access.studentId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Only enrolled students have personal attendance.",
		);
	}
	return getStudentRecords(offeringId, access.studentId);
};

// Teacher/admin: one student's detail, only if that student is in this course.
const getStudentAttendance = async (
	offeringId: string,
	studentId: string,
	user: RequestUser,
) => {
	await requireStaffAccess(user, offeringId);

	const enrollment = await prisma.enrollment.findFirst({
		where: {
			courseOfferingId: offeringId,
			studentId,
			deletedAt: null,
			status: { in: ["ENROLLED", "COMPLETED"] },
		},
		select: { student: { select: STUDENT_SELECT } },
	});
	if (!enrollment) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Student is not enrolled in this course.",
		);
	}

	return {
		student: flattenStudent(enrollment.student),
		...(await getStudentRecords(offeringId, studentId)),
	};
};

export const AttendanceService = {
	getRoster,
	markAttendance,
	getSummary,
	getMyAttendance,
	getStudentAttendance,
};
