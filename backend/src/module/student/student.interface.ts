export interface ICreateStudentPayload {
	name: string;
	email: string;
	password: string;
	registrationNumber?: string;
	phone?: string;
	dateOfBirth?: Date;
	departmentId: string;
	admissionSemesterId: string;
}

export interface IUpdateStudentPayload {
	name?: string;
	phone?: string;
	dateOfBirth?: Date;
	departmentId?: string;
}
