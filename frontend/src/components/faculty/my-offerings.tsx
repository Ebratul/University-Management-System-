"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";

import { DataTable, type Column } from "@/components/admin/data-table";
import { useSession } from "@/components/auth/session-provider";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiListRequest } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { CourseOffering } from "@/types/entities";

/** The offerings this faculty member teaches, across all semesters. */
export function MyOfferings() {
  const user = useSession();
  const facultyId = user.faculty?.id;

  const query = { facultyId, limit: 100, sortBy: "createdAt", sortOrder: "desc" as const };
  const offerings = useApiQuery({
    queryKey: queryKeys.courseOfferings.list(query),
    queryFn: () => apiListRequest<CourseOffering>("/course-offerings", query),
    enabled: Boolean(facultyId),
  });

  const columns: Column<CourseOffering>[] = [
    {
      id: "course",
      header: "Course",
      cell: (o) => (
        <Link href={`/faculty/offerings/${o.id}`} className="font-medium underline-offset-4 hover:underline">
          {o.course.title}
          <span className="text-muted-foreground block font-mono text-xs font-normal">{o.course.courseCode}</span>
        </Link>
      ),
    },
    { id: "semester", header: "Semester", cell: (o) => <Badge variant="outline">{o.semester.code} {o.semester.year}</Badge> },
    {
      id: "students",
      header: "Students",
      cell: (o) => (
        <div className="w-40 space-y-1">
          <div className="text-xs tabular-nums">{o.enrolledCount} of {o.maxSeats}</div>
          <Progress value={o.maxSeats > 0 ? (o.enrolledCount / o.maxSeats) * 100 : 0} aria-label={`${o.enrolledCount} of ${o.maxSeats} students`} />
        </div>
      ),
    },
    { id: "status", header: "Semester status", className: "hidden md:table-cell", cell: (o) => <span className="text-muted-foreground text-sm capitalize">{o.semester.status.toLowerCase()}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Teaching" title="My offerings" description="The courses you teach. Open one to see its students and enter results." />
      <DataTable
        caption="Courses you teach"
        columns={columns}
        rows={offerings.data?.data}
        isLoading={offerings.isPending}
        isError={offerings.isError}
        errorMessage={offerings.error?.message}
        onRetry={() => void offerings.refetch()}
        emptyIcon={BookOpen}
        emptyTitle="No courses assigned yet"
        emptyDescription="When the administration assigns you a course offering, it appears here."
      />
    </div>
  );
}
