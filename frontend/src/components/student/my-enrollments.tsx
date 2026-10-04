"use client";

import { ClipboardList } from "lucide-react";

import { DataTable, type Column } from "@/components/admin/data-table";
import { Badge } from "@/components/ui/badge";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiListRequest } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { PageHeader } from "@/components/shared/page-header";
import type { Enrollment, EnrollmentStatus } from "@/types/entities";

const label: Record<EnrollmentStatus, string> = { PENDING: "Pending", ENROLLED: "Enrolled", COMPLETED: "Completed", DROPPED: "Dropped" };

export function MyEnrollments() {
  const enrollments = useApiQuery({
    queryKey: queryKeys.enrollments.list({ mine: true }),
    queryFn: () => apiListRequest<Enrollment>("/enrollments", { limit: 100, sortBy: "enrolledAt", sortOrder: "desc" }),
  });

  const columns: Column<Enrollment>[] = [
    { id: "course", header: "Course", cell: (e) => <div className="min-w-0"><p className="truncate font-medium">{e.courseOffering.course.title}</p><p className="text-muted-foreground font-mono text-xs">{e.courseOffering.course.courseCode}</p></div> },
    { id: "credits", header: "Credits", className: "hidden sm:table-cell", cell: (e) => <span className="tabular-nums">{e.courseOffering.course.credits}</span> },
    { id: "semester", header: "Semester", className: "hidden md:table-cell", cell: (e) => <span>{e.courseOffering.semester ? `${e.courseOffering.semester.code} ${e.courseOffering.semester.year}` : "—"}</span> },
    { id: "status", header: "Status", cell: (e) => <Badge variant={e.status === "ENROLLED" ? "default" : e.status === "DROPPED" ? "destructive" : "secondary"}>{label[e.status]}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Academics" title="My enrolments" description="Every course you have enrolled in, with its current status." />
      <DataTable
        caption="My enrolments"
        columns={columns}
        rows={enrollments.data?.data}
        isLoading={enrollments.isPending}
        isError={enrollments.isError}
        errorMessage={enrollments.error?.message}
        onRetry={() => void enrollments.refetch()}
        emptyIcon={ClipboardList}
        emptyTitle="You are not enrolled in any course"
        emptyDescription="Browse the course list to enrol for the current semester."
      />
    </div>
  );
}
