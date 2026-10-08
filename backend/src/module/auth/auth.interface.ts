export interface IRegisterPayload {
	name: string;
	email: string;
	password: string;
	registrationNumber: string;
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

export interface IVerifyEmailPayload {
	email: string;
	code: string;
}

export interface IForgotPasswordPayload {
	email: string;
}

export interface IResetPasswordPayload {
	email: string;
	code: string;
	newPassword: string;
}
