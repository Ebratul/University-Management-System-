export type TPaginationQuery = {
	page?: string;
	limit?: string;
	sortBy?: string;
	sortOrder?: string;
};

export type TPaginationResult = {
	page: number;
	limit: number;
	skip: number;
	sortBy: string;
	sortOrder: "asc" | "desc";
};

const DEFAULT_SORT_FIELD = "createdAt";
const MAX_LIMIT = 100;

export const calculatePagination = (
	query: TPaginationQuery,
	allowedSortFields: string[] = [DEFAULT_SORT_FIELD],
): TPaginationResult => {
	const page = Math.max(1, Number(query.page) || 1);
	const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || 10));
	const skip = (page - 1) * limit;
	const sortOrder: "asc" | "desc" = query.sortOrder === "asc" ? "asc" : "desc";
	const sortBy =
		query.sortBy && allowedSortFields.includes(query.sortBy)
			? query.sortBy
			: (allowedSortFields[0] ?? DEFAULT_SORT_FIELD);

	return { page, limit, skip, sortBy, sortOrder };
};

export const buildMeta = (total: number, page: number, limit: number) => ({
	page,
	limit,
	total,
	totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
});
