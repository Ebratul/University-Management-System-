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

/** Mirrors the API rule (course-offering.constant.ts). The server enforces it; this only informs. */
const MAX_ACTIVE_COURSES = 5;

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

  const activeCount = offerings.data?.data.filter((o) => o.semester.status !== "COMPLETED").length ?? 0;
  const full = activeCount >= MAX_ACTIVE_COURSES;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Teaching"
        title="My offerings"
        description="The courses you teach. Open one for its materials, attendance, quizzes and students."
        actions={
          offerings.data ? (
            <Badge variant="outline" className={full ? "border-warning text-amber-800 dark:text-warning" : undefined}>
              {activeCount} / {MAX_ACTIVE_COURSES} courses
            </Badge>
          ) : undefined
        }
      />
      {full ? (
        <p role="status" className="bg-warning/15 rounded-lg px-3 py-2 text-sm">
          You have reached the maximum limit of {MAX_ACTIVE_COURSES} courses. Ask the administration if you need a change.
        </p>
      ) : null}
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
