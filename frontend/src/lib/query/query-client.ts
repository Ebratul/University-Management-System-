import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/errors";

/**
 * Defaults for every query in the app.
 * - Client errors (4xx) are not retried. Retrying a 403 or a 404 only wastes time.
 * - Server and network errors get one retry.
 * - Window-focus refetching is off. Dashboards would otherwise refetch on every
 *   alt-tab, and the seat counts are fresh enough at 30s.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
            return false;
          }
          return failureCount < 1;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
