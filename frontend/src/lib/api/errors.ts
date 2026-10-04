import type { FieldError } from "@/types/api";

/**
 * Normalised error for every failed API call. Components only ever see this
 * type, so they never need to know about ofetch or raw response bodies.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly errors?: FieldError[];

  constructor(message: string, status: number, errors?: FieldError[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

type FetchLikeError = Error & {
  statusCode?: number;
  data?: { message?: string; errors?: FieldError[] };
};

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof Error && "statusCode" in error) {
    const fetchError = error as FetchLikeError;
    return new ApiError(
      fetchError.data?.message ?? "The request could not be completed.",
      fetchError.statusCode ?? 500,
      fetchError.data?.errors,
    );
  }

  if (error instanceof TypeError) {
    return new ApiError("Network error. Check your connection and try again.", 0);
  }

  return new ApiError("Something went wrong. Please try again.", 500);
}
