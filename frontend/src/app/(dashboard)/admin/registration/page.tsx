import type { Metadata } from "next";
import { Suspense } from "react";

import { ManagerSkeleton } from "@/components/admin/manager-skeleton";
import { RegistrationManager } from "@/features/registration/registration-manager";

export const metadata: Metadata = {
  title: "Course registration",
};

/** Client manager. Its URL-driven list state needs the Suspense boundary. */
export default function Page() {
  return (
    <Suspense fallback={<ManagerSkeleton />}>
      <RegistrationManager />
    </Suspense>
  );
}
