import type { CourseType } from "@prisma/client";

export interface ICreateCoursePayload {
	courseCode: string;
	title: string;
	credits: number;
	description?: string;
	courseType?: CourseType;
	prerequisiteId?: string | null;
	departmentId: string;
}

export interface IUpdateCoursePayload {
	courseCode?: string;
	title?: string;
	credits?: number;
	description?: string;
	courseType?: CourseType;
	prerequisiteId?: string | null;
	departmentId?: string;
}
