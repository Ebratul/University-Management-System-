export interface ICreateCoursePayload {
	courseCode: string;
	title: string;
	credits: number;
	description?: string;
	departmentId: string;
}

export interface IUpdateCoursePayload {
	courseCode?: string;
	title?: string;
	credits?: number;
	description?: string;
	departmentId?: string;
}
