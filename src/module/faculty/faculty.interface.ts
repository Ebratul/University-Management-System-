export interface ICreateFacultyPayload {
	name: string;
	email: string;
	password: string;
	phone?: string;
	designation?: string;
	departmentId: string;
}

export interface IUpdateFacultyPayload {
	name?: string;
	phone?: string;
	designation?: string;
	departmentId?: string;
}
