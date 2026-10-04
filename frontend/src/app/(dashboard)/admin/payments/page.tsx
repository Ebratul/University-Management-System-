import type { Metadata } from "next";
import { Suspense } from "react";

import { ManagerSkeleton } from "@/components/admin/manager-skeleton";
import { PaymentsManager } from "@/features/payments/payments-manager";

export const metadata: Metadata = {
  title: "Payments",
};

export default function Page() {
  return (
    <Suspense fallback={<ManagerSkeleton />}>
      <PaymentsManager />
    </Suspense>
  );
}
