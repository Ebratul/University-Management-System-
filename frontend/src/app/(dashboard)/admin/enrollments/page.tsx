import type { Metadata } from "next";
import { Suspense } from "react";

import { ManagerSkeleton } from "@/components/admin/manager-skeleton";
import { EnrollmentsManager } from "@/features/enrollments/enrollments-manager";

export const metadata: Metadata = {
  title: "Enrolments",
};

export default function Page() {
  return (
    <Suspense fallback={<ManagerSkeleton />}>
      <EnrollmentsManager />
    </Suspense>
  );
}
