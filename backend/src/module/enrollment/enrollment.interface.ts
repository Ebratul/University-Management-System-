import type { EnrollmentStatus } from "@prisma/client";

export interface ICreateEnrollmentPayload {
	courseOfferingId: string;
}

export interface IUpdateEnrollmentStatusPayload {
	status: EnrollmentStatus;
}

export interface IEnrollmentListQuery {
	page?: string;
	limit?: string;
	sortBy?: string;
	sortOrder?: string;
	status?: string;
	studentId?: string;
	courseOfferingId?: string;
}
