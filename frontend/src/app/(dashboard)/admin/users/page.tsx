import type { Metadata } from "next";
import { Suspense } from "react";

import { ManagerSkeleton } from "@/components/admin/manager-skeleton";
import { UsersManager } from "@/features/users/users-manager";

export const metadata: Metadata = {
  title: "Users",
};

export default function Page() {
  return (
    <Suspense fallback={<ManagerSkeleton />}>
      <UsersManager />
    </Suspense>
  );
}
