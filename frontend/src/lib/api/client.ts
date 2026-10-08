import { ofetch } from "ofetch";

import type { ApiEnvelope, ListQuery, PaginatedResult } from "@/types/api";

import { toApiError } from "./errors";
import { stripUndefined } from "./query";

/**
 * Browser API client. Requests go to the same origin and are rewritten to the
 * Express API by next.config.ts, so the httpOnly auth cookies are first-party.
 */
const API_BASE_PATH = "/api/v1";

const http = ofetch.create({
  baseURL: API_BASE_PATH,
  credentials: "include",
  retry: 0,
  timeout: 20_000,
});

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

type RequestOptions = {
  method?: HttpMethod;
  body?: Record<string, unknown> | FormData;
  query?: ListQuery;
  /** Milliseconds to wait for this call. Default 20 s; long jobs (AI generation) ask for more. */
  timeout?: number;
};

// One refresh request at a time. If five requests fail with 401 together,
// they all await this promise and the refresh endpoint is called once.
let refreshInFlight: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= http("/auth/refresh-token", { method: "POST" })
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

function redirectToLogin() {
  if (typeof window === "undefined") return;

  const { pathname, search } = window.location;
  if (pathname.startsWith("/login")) return;

  // A hard navigation on purpose: it drops every cached query and in-memory
  // session value along with the expired cookies. A soft router push would
  // keep stale user data on screen.
  const next = encodeURIComponent(`${pathname}${search}`);
  window.location.replace(`/login?reason=expired&next=${next}`);
}

async function send<T>(
  path: string,
  options: RequestOptions,
  isRetry = false,
): Promise<ApiEnvelope<T>> {
  try {
    return await http<ApiEnvelope<T>>(path, {
      method: options.method ?? "GET",
      body: options.body,
      query: stripUndefined(options.query),
      timeout: options.timeout,
    });
  } catch (error) {
    const apiError = toApiError(error);
    // Auth endpoints answer 401 for bad credentials. Refreshing there would
    // loop, so only ordinary resources get the refresh-and-retry path.
    const canRefresh =
      apiError.status === 401 && !isRetry && !path.startsWith("/auth/");

    if (canRefresh) {
      const refreshed = await refreshSession();
      if (refreshed) return send<T>(path, options, true);
      redirectToLogin();
    }

    throw apiError;
  }
}

/** Calls an endpoint and returns the unwrapped `data` field. */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const envelope = await send<T>(path, options);
  return envelope.data;
}

/** Calls a list endpoint and returns `data` together with pagination `meta`. */
export async function apiListRequest<T>(
  path: string,
  query?: ListQuery,
): Promise<PaginatedResult<T>> {
  const envelope = await send<T[]>(path, { query });
  const meta = envelope.meta ?? {
    page: 1,
    limit: envelope.data.length,
    total: envelope.data.length,
    totalPages: 1,
  };

  return { data: envelope.data, meta };
}

/** Calls a route handler in this app (not the Express API) and unwraps `data`. */
export async function postLocal<T>(url: string): Promise<T> {
  try {
    const envelope = await ofetch<ApiEnvelope<T>>(url, { method: "POST" });
    return envelope.data;
  } catch (error) {
    throw toApiError(error);
  }
}
