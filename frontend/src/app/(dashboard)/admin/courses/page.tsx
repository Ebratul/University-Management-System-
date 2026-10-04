import type { Metadata } from "next";
import { Suspense } from "react";

import { ManagerSkeleton } from "@/components/admin/manager-skeleton";
import { CoursesManager } from "@/features/courses/courses-manager";

export const metadata: Metadata = {
  title: "Courses",
};

/** Client manager. Its URL-driven list state needs the Suspense boundary. */
export default function Page() {
  return (
    <Suspense fallback={<ManagerSkeleton />}>
      <CoursesManager />
    </Suspense>
  );
}
