import type { Role } from "@prisma/client";

export interface IQuery {
	searchTerm?: string;
	page?: string;
	limit?: string;
	sortOrder?: string;
	sortBy?: string;
	[key: string]: unknown;
}

export interface IActor {
	userId: string;
	email: string;
	role: Role;
}
