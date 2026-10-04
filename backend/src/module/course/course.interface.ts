export interface ICreateCoursePayload {
	courseCode: string;
	title: string;
	credits: number;
	departmentId: string;
}

export interface IUpdateCoursePayload {
	courseCode?: string;
	title?: string;
	credits?: number;
	departmentId?: string;
}
