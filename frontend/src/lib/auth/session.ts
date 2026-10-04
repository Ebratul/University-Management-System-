import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { ApiError } from "@/lib/api/errors";
import { serverRequest } from "@/lib/api/server";
import { ACCESS_COOKIE } from "@/lib/auth/token";
import type { CurrentUser } from "@/types/entities";

/**
 * The signed-in user for this request, or null. `cache` dedupes the lookup, so
 * the dashboard layout and a role layout under it make one API call, not two.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  if (!jar.has(ACCESS_COOKIE)) return null;

  try {
    const envelope = await serverRequest<CurrentUser>("/users/me", { forwardCookies: true });
    return envelope.data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
      return null;
    }
    throw error;
  }
});
