"use client";

import { ClipboardList } from "lucide-react";

import { DataTable, type Column } from "@/components/admin/data-table";
import { Pagination } from "@/components/admin/pagination";
import { RowMenu, type RowMenuItem } from "@/components/admin/row-menu";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { useListState } from "@/hooks/use-list-state";
import { apiListRequest, apiRequest } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Enrollment, EnrollmentStatus } from "@/types/entities";

const FILTER_KEYS = ["status"];
const statusLabel: Record<EnrollmentStatus, string> = { PENDING: "Pending", ENROLLED: "Enrolled", COMPLETED: "Completed", DROPPED: "Dropped" };
const statuses = Object.keys(statusLabel) as EnrollmentStatus[];

export function EnrollmentsManager() {
  const list = useListState(FILTER_KEYS);

  const enrollments = useApiQuery({
    queryKey: queryKeys.enrollments.list(list.query),
    queryFn: () => apiListRequest<Enrollment>("/enrollments", list.query),
    keepPreviousData: true,
  });

  const setStatus = useApiMutation<Enrollment, { enrollment: Enrollment; status: EnrollmentStatus }>({
    mutationFn: ({ enrollment, status }) => apiRequest<Enrollment>(`/enrollments/${enrollment.id}/status`, { method: "PATCH", body: { status } }),
    successMessage: ({ status }) => `Enrolment marked ${statusLabel[status].toLowerCase()}.`,
    invalidate: [queryKeys.enrollments.all, queryKeys.adminStats],
  });

  const columns: Column<Enrollment>[] = [
    { id: "student", header: "Student", cell: (e) => <div className="min-w-0"><p className="truncate font-medium">{e.student.name}</p><p className="text-muted-foreground font-mono text-xs">{e.student.studentId}</p></div> },
    { id: "course", header: "Course", cell: (e) => <div className="min-w-0"><p className="truncate">{e.courseOffering.course.title}</p><p className="text-muted-foreground font-mono text-xs">{e.courseOffering.course.courseCode}</p></div> },
    { id: "semester", header: "Semester", className: "hidden md:table-cell", cell: (e) => <span>{e.courseOffering.semester ? `${e.courseOffering.semester.code} ${e.courseOffering.semester.year}` : "—"}</span> },
    {
      id: "status",
      header: "Status",
      sortKey: "status",
      cell: (e) => <Badge variant={e.status === "ENROLLED" ? "default" : e.status === "DROPPED" ? "destructive" : "secondary"}>{statusLabel[e.status]}</Badge>,
    },
    { id: "enrolledAt", header: "Enrolled", className: "hidden lg:table-cell", cell: (e) => <span className="text-muted-foreground text-sm">{new Date(e.enrolledAt).toLocaleDateString("en-GB")}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Operations" title="Enrolments" description="Every student's place in a course offering. Change the status when a student is confirmed, completes the course or drops it." />

      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Filter by status"
          value={list.filters.status ?? ""}
          onChange={(event) => list.update({ status: event.target.value })}
          className="border-input bg-background h-10 rounded-md border px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>{statusLabel[status]}</option>
          ))}
        </select>
      </div>

      <DataTable
        caption="Enrolments"
        columns={columns}
        rows={enrollments.data?.data}
        isLoading={enrollments.isPending}
        isError={enrollments.isError}
        errorMessage={enrollments.error?.message}
        onRetry={() => void enrollments.refetch()}
        emptyIcon={ClipboardList}
        emptyTitle="No enrolments match"
        emptyDescription="Students enrol from their portal. Enrolments appear here as soon as they do."
        rowActions={(e) => {
          const items: RowMenuItem[] = statuses
            .filter((status) => status !== e.status)
            .map((status) => ({ label: `Mark ${statusLabel[status].toLowerCase()}`, onSelect: () => setStatus.mutate({ enrollment: e, status }) }));
          return <RowMenu label={`${e.student.name} enrolment`} groupLabel="Change status" items={items} />;
        }}
      />

      <Pagination meta={enrollments.data?.meta} limit={list.limit} onPageChange={(page) => list.update({ page })} onLimitChange={(limit) => list.update({ limit, page: 1 })} />
    </div>
  );
}
