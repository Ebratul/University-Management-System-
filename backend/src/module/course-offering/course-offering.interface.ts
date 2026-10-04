export interface ICreateCourseOfferingPayload {
	courseId: string;
	facultyId: string;
	semesterId: string;
	maxSeats?: number;
}

export interface IUpdateCourseOfferingPayload {
	maxSeats?: number;
}

export interface IAssignFacultyPayload {
	facultyId: string;
}
