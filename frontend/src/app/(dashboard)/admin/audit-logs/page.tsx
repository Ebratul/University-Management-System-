import type { Metadata } from "next";
import { Suspense } from "react";

import { ManagerSkeleton } from "@/components/admin/manager-skeleton";
import { AuditLogViewer } from "@/features/audit/audit-log-viewer";

export const metadata: Metadata = {
  title: "Audit log",
};

export default function Page() {
  return (
    <Suspense fallback={<ManagerSkeleton />}>
      <AuditLogViewer />
    </Suspense>
  );
}
