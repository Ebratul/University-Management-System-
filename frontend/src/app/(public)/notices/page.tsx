import type { Metadata } from "next";
import { Bell } from "lucide-react";

import { NoticeCard } from "@/components/catalog/cards";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getAllNotices } from "@/lib/api/public-data";

export const metadata: Metadata = {
  title: "Notices",
  description: "Public announcements from the university.",
};

export default async function NoticesPage() {
  const notices = await getAllNotices();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Announcements" title="Notices" description="Announcements open to everyone." />

      {notices.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {notices.map((notice) => (
            <li key={notice.id}>
              <NoticeCard notice={notice} href={`/notices/${notice.id}`} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Bell} title="No notices yet" description="Public announcements will be listed here." />
      )}
    </div>
  );
}
