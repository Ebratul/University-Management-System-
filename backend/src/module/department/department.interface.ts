export interface ICreateDepartmentPayload {
	name: string;
	code: string;
	universityId?: string | null;
}

export interface IUpdateDepartmentPayload {
	name?: string;
	code?: string;
	universityId?: string | null;
}
