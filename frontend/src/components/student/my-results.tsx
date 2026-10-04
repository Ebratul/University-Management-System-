"use client";

import { Award } from "lucide-react";

import { DataTable, type Column } from "@/components/admin/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiListRequest } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Result } from "@/types/entities";

import { gradePointAverage } from "@/lib/academics/gpa";

export function MyResults() {
  const results = useApiQuery({
    queryKey: queryKeys.results.list({ mine: true }),
    queryFn: () => apiListRequest<Result>("/results", { limit: 100, sortBy: "publishedAt", sortOrder: "desc" }),
  });

  const gpa = gradePointAverage(results.data?.data);
  const totalCredits = (results.data?.data ?? []).reduce((sum, r) => sum + r.enrollment.courseOffering.course.credits, 0);

  const columns: Column<Result>[] = [
    { id: "course", header: "Course", cell: (r) => <div className="min-w-0"><p className="truncate font-medium">{r.enrollment.courseOffering.course.title}</p><p className="text-muted-foreground font-mono text-xs">{r.enrollment.courseOffering.course.courseCode}</p></div> },
    { id: "credits", header: "Credits", className: "hidden sm:table-cell", cell: (r) => <span className="tabular-nums">{r.enrollment.courseOffering.course.credits}</span> },
    { id: "grade", header: "Grade", cell: (r) => <Badge variant="outline" className="font-mono text-sm">{r.grade}</Badge> },
    { id: "points", header: "Grade point", cell: (r) => <span className="tabular-nums">{r.gradePoint.toFixed(2)}</span> },
    { id: "published", header: "Published", className: "hidden md:table-cell", cell: (r) => <span className="text-muted-foreground text-sm">{new Date(r.publishedAt).toLocaleDateString("en-GB")}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Academics" title="Results" description="Published grades. Your GPA is weighted by course credits." />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Grade point average" value={gpa === null ? "—" : gpa.toFixed(2)} hint={gpa === null ? "Shown once a result is published" : `Across ${totalCredits} credits`} icon={Award} tone="violet" />
        <StatCard label="Results published" value={results.data?.meta.total ?? 0} icon={Award} tone="teal" />
      </div>

      <DataTable
        caption="Published results"
        columns={columns}
        rows={results.data?.data}
        isLoading={results.isPending}
        isError={results.isError}
        errorMessage={results.error?.message}
        onRetry={() => void results.refetch()}
        emptyIcon={Award}
        emptyTitle="No results yet"
        emptyDescription="Results appear here as soon as your faculty publishes them."
      />
    </div>
  );
}
