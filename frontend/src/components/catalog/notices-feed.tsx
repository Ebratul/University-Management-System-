"use client";

import { Bell } from "lucide-react";

import { NoticeCard } from "@/components/catalog/cards";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiListRequest } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Notice } from "@/types/entities";

/** Notices visible to the signed-in user. The API applies the audience filter, so each role sees only its own. */
export function NoticesFeed({ description = "Announcements for you and for everyone." }: { description?: string }) {
  const query = { limit: 50, sortBy: "createdAt", sortOrder: "desc" as const };
  const notices = useApiQuery({
    queryKey: queryKeys.notices.list(query),
    queryFn: () => apiListRequest<Notice>("/notices", query),
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Announcements" title="Notices" description={description} />
      {notices.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : notices.data && notices.data.data.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {notices.data.data.map((notice) => (
            <li key={notice.id}><NoticeCard notice={notice} /></li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Bell} title="No notices for you yet" description="Announcements from the university will appear here." />
      )}
    </div>
  );
}
