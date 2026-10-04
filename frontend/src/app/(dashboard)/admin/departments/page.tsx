import type { Metadata } from "next";
import { Suspense } from "react";

import { ManagerSkeleton } from "@/components/admin/manager-skeleton";
import { DepartmentsManager } from "@/features/departments/departments-manager";

export const metadata: Metadata = {
  title: "Departments",
};

/** Client manager. Its URL-driven list state needs the Suspense boundary. */
export default function Page() {
  return (
    <Suspense fallback={<ManagerSkeleton />}>
      <DepartmentsManager />
    </Suspense>
  );
}
