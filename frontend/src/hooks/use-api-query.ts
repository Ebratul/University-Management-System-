"use client";

import { keepPreviousData, useQuery, type Query, type QueryKey } from "@tanstack/react-query";

import { ApiError, toApiError } from "@/lib/api/errors";

type ApiQueryOptions<TData> = {
  queryKey: QueryKey;
  queryFn: () => Promise<TData>;
  enabled?: boolean;
  initialData?: TData;
  staleTime?: number;
  /** Keep the previous page on screen while the next one loads (paginated lists). */
  keepPreviousData?: boolean;
  /** Poll while the callback returns a number of milliseconds (or false to stop). */
  refetchInterval?: number | false | ((query: Query<TData, ApiError>) => number | false | undefined);
};

/**
 * useQuery with two guarantees: the error is always an ApiError (so the UI can
 * read `.message` and `.status` safely), and the query key is typed.
 */
export function useApiQuery<TData>({ queryFn, keepPreviousData: keepPrevious, refetchInterval, ...options }: ApiQueryOptions<TData>) {
  return useQuery<TData, ApiError>({
    ...options,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
    refetchInterval,
    queryFn: async () => {
      try {
        return await queryFn();
      } catch (error) {
        throw toApiError(error);
      }
    },
  });
}
