import type { Metadata } from "next";
import { Suspense } from "react";

import { ManagerSkeleton } from "@/components/admin/manager-skeleton";
import { SemestersManager } from "@/features/semesters/semesters-manager";

export const metadata: Metadata = {
  title: "Semesters",
};

/** Client manager. Its URL-driven list state needs the Suspense boundary. */
export default function Page() {
  return (
    <Suspense fallback={<ManagerSkeleton />}>
      <SemestersManager />
    </Suspense>
  );
}
