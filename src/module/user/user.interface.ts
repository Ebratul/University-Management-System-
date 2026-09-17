export interface IUserListQuery {
	page?: string;
	limit?: string;
	sortBy?: string;
	sortOrder?: string;
	searchTerm?: string;
	role?: string;
}

export interface IUpdateMePayload {
	name?: string;
	phone?: string;
	dateOfBirth?: Date;
}

export interface ICreateAdminPayload {
	name: string;
	email: string;
	password: string;
	phone?: string;
}
