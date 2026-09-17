export interface IAuditLogListQuery {
	page?: string;
	limit?: string;
	sortBy?: string;
	sortOrder?: string;
	action?: string;
	entityType?: string;
	entityId?: string;
	performedByUserId?: string;
	from?: string;
	to?: string;
}
