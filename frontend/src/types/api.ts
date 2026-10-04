/** Shape of every successful response from the Express API. */
export type ApiEnvelope<T> = {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  meta?: PaginationMeta;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedResult<T> = {
  data: T[];
  meta: PaginationMeta;
};

export type FieldError = {
  path: string;
  message: string;
};

/** Shape of every error response. `errors` is only present on validation failures. */
export type ApiErrorBody = {
  success: false;
  statusCode: number;
  message: string;
  errors?: FieldError[];
};

/** Query parameters accepted by list endpoints. */
export type ListQuery = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  searchTerm?: string;
} & Record<string, string | number | boolean | undefined>;
