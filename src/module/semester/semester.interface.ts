import type { SemesterStatus } from "@prisma/client";

export interface ICreateSemesterPayload {
	year: number;
	code: string;
	startDate: Date;
	endDate: Date;
	status?: SemesterStatus;
	feeAmount?: number;
}

export interface IUpdateSemesterPayload {
	year?: number;
	code?: string;
	startDate?: Date;
	endDate?: Date;
	status?: SemesterStatus;
	feeAmount?: number;
}
