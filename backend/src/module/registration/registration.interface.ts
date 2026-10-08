export interface IRegistrationSelectionPayload {
	semesterId: string;
	offeringIds: string[];
}

export interface ICancelRegistrationPayload {
	reason?: string;
	/** Admin only: mark the registration REJECTED instead of CANCELLED. */
	reject?: boolean;
}

export interface IRegistrationListQuery {
	page?: string;
	limit?: string;
	sortBy?: string;
	sortOrder?: string;
	searchTerm?: string;
	semesterId?: string;
	departmentId?: string;
	courseId?: string;
	status?: string;
	paymentStatus?: string;
}
