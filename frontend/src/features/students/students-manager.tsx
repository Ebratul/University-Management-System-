"use client";

import Link from "next/link";
import { GraduationCap } from "lucide-react";

import { DataTable, type Column } from "@/components/admin/data-table";
import { ListToolbar, useListSearch } from "@/components/admin/list-toolbar";
import { Pagination } from "@/components/admin/pagination";
import { PageHeader } from "@/components/shared/page-header";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { Badge } from "@/components/ui/badge";
import { useApiQuery } from "@/hooks/use-api-query";
import { useDepartmentOptions, useSemesterOptions } from "@/hooks/use-options";
import { useListState } from "@/hooks/use-list-state";
import { apiListRequest } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { StudentRecord } from "@/types/entities";

const FILTER_KEYS = ["departmentId", "admissionSemesterId"];

export function StudentsManager() {
  const list = useListState(FILTER_KEYS);
  const [search, setSearch] = useListSearch();
  const departments = useDepartmentOptions();
  const semesters = useSemesterOptions();

  const students = useApiQuery({
    queryKey: queryKeys.students.list(list.query),
    queryFn: () => apiListRequest<StudentRecord>("/students", list.query),
    keepPreviousData: true,
  });

  const columns: Column<StudentRecord>[] = [
    {
      id: "name",
      header: "Name",
      sortKey: "name",
      cell: (s) => (
        <div className="flex min-w-0 items-center gap-3">
          <PersonAvatar name={s.name} imageUrl={s.user?.imageUrl} />
          <Link href={`/admin/students/${s.id}`} className="truncate font-medium underline-offset-4 hover:underline">
            {s.name}
          </Link>
        </div>
      ),
    },
    { id: "registration", header: "Registration no.", className: "hidden sm:table-cell", cell: (s) => <span className="font-mono text-xs">{s.registrationNumber}</span> },
    { id: "studentId", header: "Student ID", sortKey: "studentId", className: "hidden lg:table-cell", cell: (s) => <span className="font-mono text-xs">{s.studentId}</span> },
    { id: "department", header: "Department", className: "hidden md:table-cell", cell: (s) => <span>{s.department.name}</span> },
    { id: "admission", header: "Admitted", className: "hidden lg:table-cell", cell: (s) => <Badge variant="outline">{s.admissionSemester.code} {s.admissionSemester.year}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="People" title="Students" description="Student profiles. Open a student to see their enrolments and payments." />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchLabel="Search students"
        searchPlaceholder="Search by name or student ID"
        filters={
          <div className="flex flex-col gap-3 sm:flex-row">
            <select aria-label="Filter by department" value={list.filters.departmentId ?? ""} onChange={(event) => list.update({ departmentId: event.target.value })} className="border-input bg-background h-10 max-w-64 rounded-md border px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <option value="">All departments</option>
              {departments.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select aria-label="Filter by admission semester" value={list.filters.admissionSemesterId ?? ""} onChange={(event) => list.update({ admissionSemesterId: event.target.value })} className="border-input bg-background h-10 max-w-64 rounded-md border px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <option value="">All admission semesters</option>
              {semesters.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        }
      />

      <DataTable
        caption="Students"
        columns={columns}
        rows={students.data?.data}
        isLoading={students.isPending}
        isError={students.isError}
        errorMessage={students.error?.message}
        onRetry={() => void students.refetch()}
        sortBy={list.sortBy ?? "createdAt"}
        sortOrder={list.sortOrder ?? "desc"}
        onSort={(sortKey, order) => list.update({ sortBy: sortKey, sortOrder: order, page: 1 })}
        emptyIcon={GraduationCap}
        emptyTitle="No students match"
        emptyDescription="Try a different search or filter."
      />

      <Pagination meta={students.data?.meta} limit={list.limit} onPageChange={(page) => list.update({ page })} onLimitChange={(limit) => list.update({ limit, page: 1 })} />
    </div>
  );
}
