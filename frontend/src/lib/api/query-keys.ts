import type { ListQuery } from "@/types/api";

/**
 * Central query-key factory. Keys are hierarchical so that invalidating a
 * parent (for example `queryKeys.courses.all`) refreshes every child list and
 * detail query beneath it.
 */
export const queryKeys = {
  me: ["me"] as const,

  universities: {
    all: ["universities"] as const,
    list: (query?: ListQuery) => ["universities", "list", query ?? {}] as const,
  },
  departments: {
    all: ["departments"] as const,
    list: (query?: ListQuery) => ["departments", "list", query ?? {}] as const,
    detail: (id: string) => ["departments", "detail", id] as const,
  },
  courses: {
    all: ["courses"] as const,
    list: (query?: ListQuery) => ["courses", "list", query ?? {}] as const,
    detail: (id: string) => ["courses", "detail", id] as const,
  },
  faculties: {
    all: ["faculties"] as const,
    list: (query?: ListQuery) => ["faculties", "list", query ?? {}] as const,
  },
  semesters: {
    all: ["semesters"] as const,
    list: (query?: ListQuery) => ["semesters", "list", query ?? {}] as const,
  },
  courseOfferings: {
    all: ["course-offerings"] as const,
    list: (query?: ListQuery) => ["course-offerings", "list", query ?? {}] as const,
  },
  catalogOfferings: {
    forSemester: (departmentId: string, semesterLevel: string) =>
      ["course-offerings", "catalog", departmentId, semesterLevel] as const,
  },
  notices: {
    all: ["notices"] as const,
    list: (query?: ListQuery) => ["notices", "list", query ?? {}] as const,
    detail: (id: string) => ["notices", "detail", id] as const,
  },
  users: {
    all: ["users"] as const,
    list: (query?: ListQuery) => ["users", "list", query ?? {}] as const,
  },
  students: {
    all: ["students"] as const,
    list: (query?: ListQuery) => ["students", "list", query ?? {}] as const,
    detail: (id: string) => ["students", "detail", id] as const,
  },
  enrollments: {
    all: ["enrollments"] as const,
    list: (query?: ListQuery) => ["enrollments", "list", query ?? {}] as const,
  },
  payments: {
    all: ["payments"] as const,
    list: (query?: ListQuery) => ["payments", "list", query ?? {}] as const,
    detail: (id: string) => ["payments", "detail", id] as const,
  },
  results: {
    all: ["results"] as const,
    list: (query?: ListQuery) => ["results", "list", query ?? {}] as const,
  },
  auditLogs: {
    all: ["audit-logs"] as const,
    list: (query?: ListQuery) => ["audit-logs", "list", query ?? {}] as const,
  },
  course: {
    offering: (id: string) => ["course", id, "offering"] as const,
    materials: (id: string) => ["course", id, "materials"] as const,
    attendanceAll: (id: string) => ["course", id, "attendance"] as const,
    attendanceRoster: (id: string, date: string) => ["course", id, "attendance", "roster", date] as const,
    attendanceSummary: (id: string) => ["course", id, "attendance", "summary"] as const,
    attendanceMine: (id: string) => ["course", id, "attendance", "mine"] as const,
    quizzes: (id: string) => ["course", id, "quizzes"] as const,
  },
  quiz: {
    detail: (id: string) => ["quiz", id] as const,
    results: (id: string, query?: object) => ["quiz", id, "results", query ?? {}] as const,
    myResult: (id: string) => ["quiz", id, "my-result"] as const,
  },
  registrations: {
    all: ["registrations"] as const,
    available: (semesterId?: string) => ["registrations", "available", semesterId ?? "current"] as const,
    list: (query?: ListQuery) => ["registrations", "list", query ?? {}] as const,
    detail: (id: string) => ["registrations", "detail", id] as const,
    stats: (query?: object) => ["registrations", "stats", query ?? {}] as const,
    receipt: (id: string) => ["registrations", "receipt", id] as const,
  },
  registrationSettings: ["registration-settings"] as const,
  websiteSettings: ["website-settings"] as const,
  adminStats: ["admin", "dashboard-stats"] as const,
} as const;
