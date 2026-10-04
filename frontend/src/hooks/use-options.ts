"use client";

import { useApiQuery } from "@/hooks/use-api-query";
import { apiListRequest } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Course, Department, Faculty, Semester } from "@/types/entities";

/**
 * Option lists for <select> inputs. Each loads up to 100 rows, which is the API
 * page cap; a larger catalogue would need a searchable picker instead.
 */
const OPTION_LIMIT = 100;

export function useDepartmentOptions() {
  const query = { limit: OPTION_LIMIT, sortBy: "name", sortOrder: "asc" as const };
  const result = useApiQuery({
    queryKey: queryKeys.departments.list(query),
    queryFn: () => apiListRequest<Department>("/departments", query),
  });
  return {
    options: result.data?.data.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` })) ?? [],
    isLoading: result.isPending,
  };
}

export function useSemesterOptions() {
  const query = { limit: OPTION_LIMIT, sortBy: "year", sortOrder: "desc" as const };
  const result = useApiQuery({
    queryKey: queryKeys.semesters.list(query),
    queryFn: () => apiListRequest<Semester>("/semesters", query),
  });
  return {
    semesters: result.data?.data ?? [],
    options: result.data?.data.map((s) => ({ value: s.id, label: `${s.code} ${s.year}` })) ?? [],
    isLoading: result.isPending,
  };
}

export function useCourseOptions() {
  const query = { limit: OPTION_LIMIT, sortBy: "courseCode", sortOrder: "asc" as const };
  const result = useApiQuery({
    queryKey: queryKeys.courses.list(query),
    queryFn: () => apiListRequest<Course>("/courses", query),
  });
  return {
    options: result.data?.data.map((c) => ({ value: c.id, label: `${c.courseCode} · ${c.title}` })) ?? [],
    isLoading: result.isPending,
  };
}

export function useFacultyOptions() {
  const query = { limit: OPTION_LIMIT, sortBy: "name", sortOrder: "asc" as const };
  const result = useApiQuery({
    queryKey: queryKeys.faculties.list(query),
    queryFn: () => apiListRequest<Faculty>("/faculties", query),
  });
  return {
    options: result.data?.data.map((f) => ({ value: f.id, label: `${f.name} (${f.facultyId})` })) ?? [],
    isLoading: result.isPending,
  };
}
