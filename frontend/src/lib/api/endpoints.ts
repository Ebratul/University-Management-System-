import type { LoginInput } from "@/lib/validations/auth";
import type {
  AuthSessionUser,
  CurrentUser,
  Department,
  Semester,
  WebsiteSettings,
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

export const websiteSettingsApi = {
  get: () => apiRequest<WebsiteSettings>("/website-settings"),

  update: (body: { universityName?: string; tagline?: string }) =>
    apiRequest<WebsiteSettings>("/website-settings", { method: "PATCH", body }),

  uploadLogo: (file: File) => {
    const body = new FormData();
    body.append("logo", file);
    return apiRequest<WebsiteSettings>("/website-settings/logo", { method: "POST", body });
  },
  removeLogo: () => apiRequest<WebsiteSettings>("/website-settings/logo", { method: "DELETE" }),

  uploadBackground: (file: File) => {
    const body = new FormData();
    body.append("background", file);
    return apiRequest<WebsiteSettings>("/website-settings/background", { method: "POST", body });
  },
  removeBackground: () =>
    apiRequest<WebsiteSettings>("/website-settings/background", { method: "DELETE" }),
};
