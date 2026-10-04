import type { Metadata } from "next";
import { Suspense } from "react";

import { ManagerSkeleton } from "@/components/admin/manager-skeleton";
import { StudentsManager } from "@/features/students/students-manager";

export const metadata: Metadata = {
  title: "Students",
};

export default function Page() {
  return (
    <Suspense fallback={<ManagerSkeleton />}>
      <StudentsManager />
    </Suspense>
  );
}
