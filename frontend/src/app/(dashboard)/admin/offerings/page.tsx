import type { Metadata } from "next";
import { Suspense } from "react";

import { ManagerSkeleton } from "@/components/admin/manager-skeleton";
import { OfferingsManager } from "@/features/offerings/offerings-manager";

export const metadata: Metadata = {
  title: "Course offerings",
};

/** Client manager. Its URL-driven list state needs the Suspense boundary. */
export default function Page() {
  return (
    <Suspense fallback={<ManagerSkeleton />}>
      <OfferingsManager />
    </Suspense>
  );
}
