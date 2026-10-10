import type { Role } from "@/types/entities";

export type AppNavItem = { label: string; href: string; roles: Role[] };

/** Admin areas, shown in the admin sub-navigation. Each route lives under /admin. */
export const ADMIN_NAV: AppNavItem[] = [
  { label: "Overview", href: "/admin", roles: ["ADMIN"] },
  { label: "Universities", href: "/admin/universities", roles: ["ADMIN"] },
  { label: "Departments", href: "/admin/departments", roles: ["ADMIN"] },
  { label: "Semesters", href: "/admin/semesters", roles: ["ADMIN"] },
  { label: "Courses", href: "/admin/courses", roles: ["ADMIN"] },
  { label: "Faculty", href: "/admin/faculties", roles: ["ADMIN"] },
  { label: "Offerings", href: "/admin/offerings", roles: ["ADMIN"] },
  { label: "Registration", href: "/admin/registration", roles: ["ADMIN"] },
  { label: "Users", href: "/admin/users", roles: ["ADMIN"] },
  { label: "Students", href: "/admin/students", roles: ["ADMIN"] },
  { label: "Enrolments", href: "/admin/enrollments", roles: ["ADMIN"] },
  { label: "Notices", href: "/admin/notices", roles: ["ADMIN"] },
  { label: "Payments", href: "/admin/payments", roles: ["ADMIN"] },
  { label: "Website", href: "/admin/website", roles: ["ADMIN"] },
  { label: "Audit log", href: "/admin/audit-logs", roles: ["ADMIN"] },
];

/** Student area sections. */
export const STUDENT_NAV: AppNavItem[] = [
  { label: "Overview", href: "/student", roles: ["STUDENT"] },
  { label: "Courses", href: "/student/courses", roles: ["STUDENT"] },
  { label: "Registration", href: "/student/registration", roles: ["STUDENT"] },
  { label: "My registrations", href: "/student/registrations", roles: ["STUDENT"] },
  { label: "My enrolments", href: "/student/enrollments", roles: ["STUDENT"] },
  { label: "Results", href: "/student/results", roles: ["STUDENT"] },
  { label: "Payments", href: "/student/payments", roles: ["STUDENT"] },
  { label: "Notices", href: "/student/notices", roles: ["STUDENT"] },
  { label: "Profile", href: "/student/profile", roles: ["STUDENT"] },
];

/** Faculty area sections. */
export const FACULTY_NAV: AppNavItem[] = [
  { label: "Overview", href: "/faculty", roles: ["FACULTY"] },
  { label: "My offerings", href: "/faculty/offerings", roles: ["FACULTY"] },
  { label: "Notices", href: "/faculty/notices", roles: ["FACULTY"] },
  { label: "Profile", href: "/faculty/profile", roles: ["FACULTY"] },
];
