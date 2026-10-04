import type { LoginInput } from "@/lib/validations/auth";
import type {
  AuthSessionUser,
  CurrentUser,
  Department,
  Semester,
} from "@/types/entities";

import { apiListRequest, apiRequest } from "./client";

/** Typed client-side calls. Components import these instead of building URLs. */
export const authApi = {
  login: (body: LoginInput) =>
    apiRequest<AuthSessionUser>("/auth/login", { method: "POST", body }),

  register: (body: Record<string, unknown>) =>
    apiRequest<AuthSessionUser>("/auth/register", { method: "POST", body }),

  logout: () => apiRequest<null>("/auth/logout", { method: "POST" }),
};

export const usersApi = {
  me: () => apiRequest<CurrentUser>("/users/me"),
};

export const catalogApi = {
  departments: () =>
    apiListRequest<Department>("/departments", {
      limit: 100,
      sortBy: "name",
      sortOrder: "asc",
    }),

  semesters: () =>
    apiListRequest<Semester>("/semesters", {
      limit: 100,
      sortBy: "year",
      sortOrder: "desc",
    }),
};
