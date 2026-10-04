import type { ApiError } from "@/lib/api/errors";

/**
 * Turns an API validation error into a short summary for an alert. Field
 * messages from the API are de-duplicated and shown as a list under the
 * headline message.
 */
export function summariseApiError(error: ApiError): { message: string; details: string[] } {
  const details = (error.errors ?? []).map((issue) => issue.message);
  return { message: error.message, details: Array.from(new Set(details)) };
}
