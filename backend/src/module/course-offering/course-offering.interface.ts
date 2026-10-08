export interface ICreateCourseOfferingPayload {
	courseId: string;
	facultyId: string;
	semesterId: string;
	maxSeats?: number;
	semesterLevel?: number | null;
	registrationEnabled?: boolean;
}

export interface IUpdateCourseOfferingPayload {
	maxSeats?: number;
	semesterLevel?: number | null;
	registrationEnabled?: boolean;
}

export interface IAssignFacultyPayload {
	facultyId: string;
}
