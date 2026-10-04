import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";

import { CourseCard } from "@/components/catalog/cards";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  getAllDepartments,
  getCoursesByDepartment,
  getDepartment,
} from "@/lib/api/public-data";

/**
 * Pre-renders every department at build time. A department added later is
 * generated on its first visit (dynamicParams defaults to true) and then
 * cached. If the API is unreachable at build time, the list is empty and
 * pages are generated on demand.
 */
export async function generateStaticParams() {
  const departments = await getAllDepartments().catch(() => []);
  return departments.map((department) => ({ id: department.id }));
}

export async function generateMetadata({ params }: PageProps<"/departments/[id]">): Promise<Metadata> {
  const { id } = await params;
  const department = await getDepartment(id);
  if (!department) return { title: "Department not found" };

  return {
    title: department.name,
    description: `Courses offered by the ${department.name} department.`,
  };
}

export default async function DepartmentPage({ params }: PageProps<"/departments/[id]">) {
  const { id } = await params;
  const [department, courses] = await Promise.all([getDepartment(id), getCoursesByDepartment(id)]);

  if (!department) notFound();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
        <Link href="/departments" className="hover:text-foreground underline-offset-4 hover:underline">
          Departments
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">{department.name}</span>
      </nav>

      <PageHeader
        eyebrow={department.code}
        title={department.name}
        description={`${courses.length} ${courses.length === 1 ? "course" : "courses"} offered`}
        actions={
          <Button asChild variant="outline">
            <Link href="/courses">All courses</Link>
          </Button>
        }
      />

      {courses.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <li key={course.id}>
              <CourseCard course={course} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={BookOpen} title="No courses listed yet" description="Courses for this department will appear here." />
      )}
    </div>
  );
}
