import type { Metadata } from "next";
import { Suspense } from "react";

import { FacultyDirectory } from "@/components/catalog/faculty-directory";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllFaculties } from "@/lib/api/public-data";

export const metadata: Metadata = {
  title: "Faculty directory",
  description: "Find the faculty members who teach at the university.",
};

export default async function FacultiesPage() {
  const faculties = await getAllFaculties();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader eyebrow="People" title="Faculty directory" description="Search by name, designation or department." />

      <Suspense
        fallback={
          <div className="space-y-6">
            <Skeleton className="h-10 w-full sm:max-w-xs" />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: Math.min(Math.max(faculties.length, 1), 12) }, (_, index) => (
                <li key={index}>
                  <Skeleton className="h-36 w-full rounded-xl" />
                </li>
              ))}
            </ul>
          </div>
        }
      >
        <FacultyDirectory faculties={faculties} />
      </Suspense>
    </div>
  );
}
