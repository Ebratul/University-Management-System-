"use client";

import { createContext, useContext, type ReactNode } from "react";

import { useApiQuery } from "@/hooks/use-api-query";
import { queryKeys } from "@/lib/api/query-keys";
import { usersApi } from "@/lib/api/endpoints";
import type { CurrentUser } from "@/types/entities";

const SessionContext = createContext<CurrentUser | null>(null);

/**
 * Makes the signed-in user available to client components. The server layout
 * passes the user in as `initialData`, so the first render needs no request.
 * It is refetched after five minutes, or when the `me` key is invalidated.
 */
export function SessionProvider({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const { data } = useApiQuery({
    queryKey: queryKeys.me,
    queryFn: usersApi.me,
    initialData: user,
    staleTime: 5 * 60_000,
  });

  return <SessionContext value={data ?? user}>{children}</SessionContext>;
}

export function useSession(): CurrentUser {
  const user = useContext(SessionContext);
  if (!user) {
    throw new Error("useSession must be used inside <SessionProvider>.");
  }
  return user;
}
