import type { Metadata } from "next";
import { Suspense } from "react";

import { CourseCatalog } from "@/components/catalog/course-catalog";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllCourses, getAllDepartments } from "@/lib/api/public-data";

export const metadata: Metadata = {
  title: "Courses",
  description: "Search and filter the full course catalogue.",
};

/**
 * The full list is generated at build time. Search and the department filter
 * run in the browser and are stored in the URL, so this page stays static.
 */
export default async function CoursesPage() {
  const [courses, departments] = await Promise.all([getAllCourses(), getAllDepartments()]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Academics" title="Course catalogue" description="Find a course by title or code, or narrow the list to one department." />

      <Suspense fallback={<CatalogSkeleton count={courses.length} />}>
        <CourseCatalog courses={courses} departments={departments} />
      </Suspense>
    </div>
  );
}

/** Matches the real list, so the layout does not shift when the client list takes over. */
function CatalogSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <span className="sr-only">Loading courses…</span>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-10 w-full sm:max-w-xs" />
        <Skeleton className="h-10 w-full sm:w-64" />
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: Math.min(Math.max(count, 1), 12) }, (_, index) => (
          <li key={index}>
            <Skeleton className="h-[9.25rem] w-full rounded-xl" />
          </li>
        ))}
      </ul>
    </div>
  );
}
