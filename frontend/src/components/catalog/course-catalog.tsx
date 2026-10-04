"use client";

import { useMemo } from "react";
import { SearchX } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUrlParam } from "@/hooks/use-url-param";
import type { Course, Department } from "@/types/entities";

import { CourseCard } from "./cards";
import { SearchField } from "./search-field";

const ALL_DEPARTMENTS = "all";

/**
 * Filters the statically generated course list in the browser. Search text and
 * department live in the URL (?q=&department=), so a filtered view can be
 * bookmarked or shared.
 */
export function CourseCatalog({ courses, departments }: { courses: Course[]; departments: Department[] }) {
  const [query, setQuery] = useUrlParam("q");
  const [departmentId, setDepartmentId] = useUrlParam("department", 0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return courses.filter((course) => {
      if (departmentId && course.departmentId !== departmentId) return false;
      if (!needle) return true;
      return (
        course.title.toLowerCase().includes(needle) ||
        course.courseCode.toLowerCase().includes(needle)
      );
    });
  }, [courses, query, departmentId]);

  const filtersActive = Boolean(query || departmentId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField
          label="Search courses"
          placeholder="Search by title or code"
          value={query}
          onChange={setQuery}
        />
        <Select
          value={departmentId || ALL_DEPARTMENTS}
          onValueChange={(value) => setDepartmentId(value === ALL_DEPARTMENTS ? "" : value)}
        >
          <SelectTrigger aria-label="Filter by department" className="h-10 w-full sm:w-64">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_DEPARTMENTS}>All departments</SelectItem>
            {departments.map((department) => (
              <SelectItem key={department.id} value={department.id}>
                {department.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p aria-live="polite" className="text-muted-foreground text-sm">
        Showing {filtered.length} of {courses.length} courses
      </p>

      {filtered.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => (
            <li key={course.id}>
              <CourseCard course={course} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={SearchX}
          title="No courses match your filters"
          description="Try a different search term or choose another department."
          action={
            filtersActive ? (
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setDepartmentId("");
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
