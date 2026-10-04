import type { Metadata } from "next";

import { AdminOverview } from "@/components/admin/admin-overview";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = {
  title: "Administration",
};

export default function AdminHomePage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Administration" title="Overview" description="Live figures for the whole university, and shortcuts to every admin area." />
      <AdminOverview />
    </div>
  );
}
