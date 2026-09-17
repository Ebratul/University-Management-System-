export interface IRegisterPayload {
	name: string;
	email: string;
	password: string;
	phone?: string;
	dateOfBirth?: Date;
	departmentId: string;
	admissionSemesterId: string;
}

export interface ILoginPayload {
	email: string;
	password: string;
}

export interface IGoogleLoginPayload {
	idToken: string;
}
