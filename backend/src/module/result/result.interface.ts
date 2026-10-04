export interface ICreateResultPayload {
	enrollmentId: string;
	grade: string;
	gradePoint: number;
}

export interface IUpdateResultPayload {
	grade?: string;
	gradePoint?: number;
}

export interface IResultListQuery {
	page?: string;
	limit?: string;
	sortBy?: string;
	sortOrder?: string;
	studentId?: string;
	semesterId?: string;
	courseOfferingId?: string;
}
