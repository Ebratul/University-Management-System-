"use client";

import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError, toApiError } from "@/lib/api/errors";

type ApiMutationOptions<TData, TVariables> = {
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Shown as a toast on success. */
  successMessage?: string | ((data: TData, variables: TVariables) => string);
  /** Query keys to refetch after a successful write. */
  invalidate?: QueryKey[];
  /** Set false when the caller shows the error itself, for example inline on a form. */
  notifyError?: boolean;
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
};

/**
 * useMutation with the app's conventions built in: a toast for the outcome,
 * automatic cache invalidation, and ApiError as the error type.
 */
export function useApiMutation<TData, TVariables = void>({
  mutationFn,
  successMessage,
  invalidate,
  notifyError = true,
  onSuccess,
}: ApiMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();

  return useMutation<TData, ApiError, TVariables>({
    mutationFn: async (variables) => {
      try {
        return await mutationFn(variables);
      } catch (error) {
        throw toApiError(error);
      }
    },
    onSuccess: async (data, variables) => {
      if (successMessage) {
        toast.success(
          typeof successMessage === "function"
            ? successMessage(data, variables)
            : successMessage,
        );
      }

      await Promise.all(
        (invalidate ?? []).map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
      await onSuccess?.(data, variables);
    },
    onError: (error) => {
      if (notifyError) toast.error(error.message);
    },
  });
}
