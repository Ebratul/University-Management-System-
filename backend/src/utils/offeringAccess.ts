import { Role } from "@prisma/client";
import httpStatus from "http-status";

import { prisma } from "../lib/prisma";
import type { RequestUser } from "../middleware/checkAuth";
import { AppError } from "./AppError";

export type TOfferingAccess = {
	offeringId: string;
	/** ADMIN: any course. STAFF: the faculty who teaches it. STUDENT: an enrolled student. */
	kind: "admin" | "teacher" | "student";
	/** Set when kind === "student". */
	studentId?: string;
};

// Enrollment statuses that grant access to a course's content. PENDING and
// DROPPED students do not belong to the course (yet / any more).
const MEMBER_STATUSES = ["ENROLLED", "COMPLETED"] as const;

/**
 * The one place that decides who may touch a course offering's content
 * (materials, attendance, quizzes). Always derive membership from the session
 * and the database, never from anything the client sends.
 */
export const resolveOfferingAccess = async (
	user: RequestUser,
	offeringId: string,
): Promise<TOfferingAccess> => {
	const offering = await prisma.courseOffering.findFirst({
		where: { id: offeringId, deletedAt: null },
		select: { id: true, faculty: { select: { userId: true } } },
	});
	if (!offering) {
		throw new AppError(httpStatus.NOT_FOUND, "Course not found.");
	}

	const denied = () =>
		new AppError(
			httpStatus.FORBIDDEN,
			"You do not have access to this course.",
		);

	if (user.role === Role.ADMIN) return { offeringId, kind: "admin" };

	if (user.role === Role.FACULTY) {
		if (offering.faculty.userId !== user.userId) throw denied();
		return { offeringId, kind: "teacher" };
	}

	const student = await prisma.student.findFirst({
		where: { userId: user.userId, deletedAt: null },
		select: { id: true },
	});
	if (!student) throw denied();

	const enrollment = await prisma.enrollment.findFirst({
		where: {
			studentId: student.id,
			courseOfferingId: offeringId,
			deletedAt: null,
			status: { in: [...MEMBER_STATUSES] },
		},
		select: { id: true },
	});
	if (!enrollment) throw denied();

	return { offeringId, kind: "student", studentId: student.id };
};

/** Teacher-of-this-course or admin only. */
export const requireStaffAccess = async (
	user: RequestUser,
	offeringId: string,
): Promise<TOfferingAccess> => {
	const access = await resolveOfferingAccess(user, offeringId);
	if (access.kind === "student") {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Only the course teacher can do this.",
		);
	}
	return access;
};
