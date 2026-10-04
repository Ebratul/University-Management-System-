import type { Metadata } from "next";
import { Suspense } from "react";

import { ManagerSkeleton } from "@/components/admin/manager-skeleton";
import { FacultiesManager } from "@/features/faculties/faculties-manager";

export const metadata: Metadata = {
  title: "Faculty",
};

/** Client manager. Its URL-driven list state needs the Suspense boundary. */
export default function Page() {
  return (
    <Suspense fallback={<ManagerSkeleton />}>
      <FacultiesManager />
    </Suspense>
  );
}
