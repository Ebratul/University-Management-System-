import type { Metadata } from "next";
import { Suspense } from "react";

import { ManagerSkeleton } from "@/components/admin/manager-skeleton";
import { UniversitiesManager } from "@/features/universities/universities-manager";

export const metadata: Metadata = {
  title: "Universities",
};

/** Client manager. Its URL-driven list state needs the Suspense boundary. */
export default function Page() {
  return (
    <Suspense fallback={<ManagerSkeleton />}>
      <UniversitiesManager />
    </Suspense>
  );
}
