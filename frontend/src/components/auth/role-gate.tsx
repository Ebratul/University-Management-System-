"use client";

import type { ReactNode } from "react";

import { useSession } from "@/components/auth/session-provider";
import type { Role } from "@/types/entities";

/**
 * Renders children only for the listed roles. This controls what the UI shows.
 * It is not a security boundary: the API and the role layouts enforce access.
 */
export function RoleGate({
  roles,
  children,
  fallback = null,
}: {
  roles: Role[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const user = useSession();
  return roles.includes(user.role) ? children : fallback;
}
