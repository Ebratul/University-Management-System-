import "server-only";

import { cookies, headers } from "next/headers";
import { ofetch } from "ofetch";

import { serverEnv } from "@/lib/env.server";
import type { ApiEnvelope, ListQuery } from "@/types/api";

import { ApiError, toApiError } from "./errors";
import { clientIpFrom } from "@/lib/net/client-ip";

import { stripUndefined } from "./query";

/**
 * Server API client. Used by Server Components, SSG and route handlers.
 * It calls the Express API directly (BACKEND_URL), not through the rewrite.
 */
const serverHttp = ofetch.create({
  baseURL: `${serverEnv.BACKEND_URL}/api/v1`,
  retry: 0,
  timeout: 15_000,
});

type ServerRequestOptions = {
  query?: ListQuery;
  /**
   * Public data: ISR interval in seconds. Pages built from it are static and
   * refreshed in the background. Omit for personal data.
   */
  revalidate?: number;
  /** Personal data: forward the visitor's auth cookies and never cache. */
  forwardCookies?: boolean;
};

export async function serverRequest<T>(
  path: string,
  options: ServerRequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const headers: Record<string, string> = { accept: "application/json" };

  if (options.forwardCookies) {
    const jar = await cookies();
    if (jar.size > 0) headers.cookie = jar.toString();

    // Personal reads are per visitor, so the API should rate-limit them per visitor too.
    const ip = clientIpFrom(await requestHeaders());
    if (ip) headers["x-forwarded-for"] = ip;
  }

  try {
    return await serverHttp<ApiEnvelope<T>>(path, {
      method: "GET",
      query: stripUndefined(options.query),
      headers,
      cache: options.forwardCookies ? "no-store" : undefined,
      next:
        options.revalidate !== undefined
          ? { revalidate: options.revalidate }
          : undefined,
    });
  } catch (error) {
    throw toApiError(error);
  }
}

async function requestHeaders(): Promise<Headers> {
  return headers();
}

/** Walks every page of a list endpoint. The API caps `limit` at 100. */
export async function fetchAllPages<T>(
  path: string,
  options: { query?: ListQuery; revalidate?: number } = {},
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;

  for (;;) {
    const envelope = await serverRequest<T[]>(path, {
      ...options,
      query: { ...options.query, page, limit: 100 },
    });
    items.push(...envelope.data);

    const totalPages = envelope.meta?.totalPages ?? 1;
    if (page >= totalPages) break;
    page += 1;
  }

  return items;
}

/** Returns null for a 404 so the caller can call notFound(). */
export async function fetchOne<T>(
  path: string,
  options: { revalidate?: number } = {},
): Promise<T | null> {
  try {
    const envelope = await serverRequest<T>(path, options);
    return envelope.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
