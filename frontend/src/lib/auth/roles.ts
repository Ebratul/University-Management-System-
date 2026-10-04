import type { Role } from "@/types/entities";

/** Role metadata shared by client and server code. Keep this file free of server-only imports. */
export const ROLE_META: Record<Role, { label: string; home: string; description: string }> = {
  ADMIN: {
    label: "Administrator",
    home: "/admin",
    description: "Manage academics, people, notices and payments.",
  },
  FACULTY: {
    label: "Faculty",
    home: "/faculty",
    description: "Manage your course offerings, students and results.",
  },
  STUDENT: {
    label: "Student",
    home: "/student",
    description: "Enrol in courses, check results and pay fees.",
  },
};

export function homeForRole(role: Role): string {
  return ROLE_META[role].home;
}

/** Maps the lowercase URL segment used by /api/demo-login/[role] to a Role. */
export const DEMO_ROLE_SEGMENT: Record<string, Role> = {
  admin: "ADMIN",
  faculty: "FACULTY",
  student: "STUDENT",
};

/** Accepts only same-site relative paths, so ?next= cannot redirect off-site. */
export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  return value;
}
