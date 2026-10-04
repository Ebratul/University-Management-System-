import type { Metadata } from "next";
import { Suspense } from "react";

import { ManagerSkeleton } from "@/components/admin/manager-skeleton";
import { NoticesManager } from "@/features/notices/notices-manager";

export const metadata: Metadata = {
  title: "Notices",
};

export default function Page() {
  return (
    <Suspense fallback={<ManagerSkeleton />}>
      <NoticesManager />
    </Suspense>
  );
}
