import type { Metadata } from "next";
import { Building2 } from "lucide-react";

import { DepartmentCard } from "@/components/catalog/cards";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getAllDepartments } from "@/lib/api/public-data";

export const metadata: Metadata = {
  title: "Departments",
  description: "Every academic department at the university.",
};

export default async function DepartmentsPage() {
  const departments = await getAllDepartments();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Academics"
        title="Departments"
        description="Explore the departments and find the courses each one offers."
      />

      {departments.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((department) => (
            <li key={department.id}>
              <DepartmentCard department={department} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Building2} title="No departments yet" description="Departments will be listed here once they are added." />
      )}
    </div>
  );
}
