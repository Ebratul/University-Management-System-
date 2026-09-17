export interface IInitiatePaymentPayload {
	semesterId: string;
}

export interface IPaymentCallbackQuery {
	paymentID?: string;
	status?: string;
}

export interface IPaymentListQuery {
	page?: string;
	limit?: string;
	sortBy?: string;
	sortOrder?: string;
	status?: string;
	semesterId?: string;
	studentId?: string;
}
