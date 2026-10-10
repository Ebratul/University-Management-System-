export interface ICreateUniversityPayload {
	name: string;
	studentDomain: string;
	teacherDomain: string;
	isActive?: boolean;
}

export type IUpdateUniversityPayload = Partial<ICreateUniversityPayload>;
